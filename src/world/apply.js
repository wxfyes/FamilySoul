/**
 * Apply 唯一结算层 —— 七层管道的第五层
 * 
 * 职责：
 * 1. 【单一写者】：全系统唯一直接变更 state 并持久化 saveState 的枢纽
 * 2. 【幂等防重】：记录 appliedActions，同一 actionId 重复提交 3 次，状态只变 1 次
 * 3. 【双端版本】：每次有效变更递增 world.version，保障客户端增量一致性
 * 4. 【即时辟景】：若目标地点不存在，自动造景入册，拒绝幽灵地点
 * 5. 【同行同步】：根据裁决结果，原子级同步发起者与受邀同行者的坐标
 * 6. 【真值写入】：严格按真实 schema 写入 relations[actor].trust 与 location ID
 */

import { saveState } from './state.js';
import { VERBS } from './intent.js';
import { getPlaceDisplayName } from './gate.js';
import { addToParty, removeFromParty, onMemberSelfAction } from './party.js';
import { materializeRoom } from './residence.js';

const MAX_APPLIED_CACHE = 300;

function pruneAppliedActions(world) {
  if (!world.appliedActions) {
    world.appliedActions = {};
    return;
  }
  const keys = Object.keys(world.appliedActions);
  if (keys.length > MAX_APPLIED_CACHE) {
    keys.slice(0, keys.length - MAX_APPLIED_CACHE).forEach((k) => {
      delete world.appliedActions[k];
    });
  }
}

/**
 * 全系统唯一状态结算器
 * @param {object} params
 * @param {string} params.dataDir 数据目录
 * @param {object} params.world 当前世界状态对象
 * @param {object} params.intent 标准 Intent 对象
 * @param {object} [params.verdict] 天道裁决结果
 * @param {object} [params.gate] 门禁校验报告
 * @returns {{ world: object, applied: boolean, skipped: boolean, event: object|null }}
 */
export function applyAction({ dataDir, world, intent, verdict = {}, gate = null }) {
  if (!world || !intent || !intent.id) {
    console.warn('[Apply] 无效的结算请求: 缺少 world 或 intent.id');
    return { world, applied: false, skipped: true, event: null };
  }

  // 1. 幂等校验 (I2 幂等)
  if (!world.appliedActions) world.appliedActions = {};
  if (world.appliedActions[intent.id]) {
    console.log(`[Apply:${intent.id}] 幂等拦截: 该动作已完成结算，跳过重复执行`);
    return { world, applied: false, skipped: true, event: null };
  }

  const actorId = intent.actor || 'husband';
  const actor = world.actors?.[actorId] || world.actors?.husband;
  if (!actor) {
    console.warn(`[Apply:${intent.id}] 结算失败: 发起人【${actorId}】不存在`);
    return { world, applied: false, skipped: true, event: null };
  }

  let stateChanged = false;
  let actionEvent = null;

  // 若相公明确拒绝了此前的邀约，清空待确认邀约 (缺口②)
  if (intent.params?.rejectPending && world.pendingInvitation) {
    delete world.pendingInvitation;
    stateChanged = true;
    console.log(`[Apply:${intent.id}] 清空已拒绝的待确认邀约`);
  }

  // 队伍脱队处理（无论 MOVE 还是 CHAT，只要相公下令脱队即时生效）
  if (actorId === 'husband' && intent.params?.leaveParty) {
    if (intent.params.leaveParty === 'all') {
      removeFromParty(world, 'husband', null);
    } else {
      removeFromParty(world, 'husband', intent.params.leaveParty);
    }
    stateChanged = true;
  }

  // 2. 动词结算
  switch (intent.verb) {
    case VERBS.MOVE: {
      const targetPlaceName = verdict.target || intent.target;
      if (!targetPlaceName) break;

      // 解析真实的 location ID（若世界已有此地则取其 ID，若无则动态辟建入册）
      if (!world.places) world.places = {};
      let finalTargetId = gate?.context?.targetPlaceId || null;

      if (!finalTargetId) {
        // 目标是账上的院子（如 "husband_room__garden" 或 "王宅·后花园"）→ 先展开成地点
        try {
          const raw = String(targetPlaceName);
          if (raw.includes('__')) {
            const [parentId, key] = raw.split('__');
            const made = materializeRoom(world, parentId, key);
            if (made) finalTargetId = made;
          } else {
            for (const [pid, pl] of Object.entries(world.places)) {
              if (!pl || !pl.rooms) continue;
              for (const [k, rec] of Object.entries(pl.rooms)) {
                if (!rec || !rec.name) continue;
                if (rec.name !== raw && `${String(pl.name || '').split('·').pop()}·${rec.name}` !== raw) continue;
                const made = materializeRoom(world, pid, k);
                if (made) finalTargetId = made;
                break;
              }
              if (finalTargetId) break;
            }
          }
        } catch { /* 忽略 */ }
      }

      if (!finalTargetId) {
        // 精确名 → 以该名结尾（如"临江·王宅·正房" ← "正房"）→ 才轮到包含；
        // 绝不做"柳婶家 匹配到 刘婶家"这种串门
        const exact = Object.entries(world.places).find(([k, p]) => k === targetPlaceName || p?.name === targetPlaceName);
        const suffix = exact ? null : Object.entries(world.places).find(([, p]) => {
          const n = String(p?.name || '');
          return n.endsWith(`·${targetPlaceName}`) || n.endsWith(targetPlaceName);
        });
        const found = exact || suffix;
        if (found) {
          finalTargetId = found[0];
        } else {
          // 先按"去哪儿"的规则翻译一次（王宅→正房/大门、后院→后院花园…），能落回真实地点就不造新景
          let mapped = null;
          try {
            mapped = resolvePlaceTarget(world, targetPlaceName, { nearId: actor.location, actor });
          } catch { /* 忽略 */ }
          const looksRealPlace = /宅|院|府|楼|铺|店|栈|坊|仓|衙|寺|观|庙|街|巷|桥|渡|场|坊/.test(String(targetPlaceName));
          if (mapped && world.places?.[mapped]) {
            finalTargetId = mapped;
            console.log(`[Apply:${intent.id}] 目标「${targetPlaceName}」归位到「${world.places[mapped].name}」`);
          } else if (!looksRealPlace) {
            // 不像地名：不造景，原地不动，交给天道用台词处理
            console.log(`[Apply:${intent.id}] 目标「${targetPlaceName}」不是地名，不辟新景`);
            break;
          } else {
          world.flags = world.flags || {};
          world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
          finalTargetId = `place_${world.flags.placeSeq}`;
          world.dynamicPlaces = world.dynamicPlaces || {};
          world.dynamicPlaces[finalTargetId] = {
            id: finalTargetId,
            name: targetPlaceName,
            exits: ['street'],
            dynamic: true,
            builtBy: actor.name || actorId,
            createdDay: world.clock?.day || 1,
            desc: `天道应时辟建之新景：${targetPlaceName}`,
          };
          world.places[finalTargetId] = world.dynamicPlaces[finalTargetId];
          console.log(`[Apply:${intent.id}] 天道造景入册: 成功辟建【${targetPlaceName}】(id=${finalTargetId})`);
          stateChanged = true;
          }
        }
      }

      // 移动发起者
      const oldLoc = actor.location;
      if (actor.location !== finalTargetId) {
        actor.location = finalTargetId;
        stateChanged = true;
      }

      // 若为外人找相公且相公在私密内宅，相公闻讯同步移步到【临江茶坊】相见
      if (intent.params?.meetHusbandAtTeaHouse && world.actors?.husband) {
        const hus = world.actors.husband;
        if (['husband_room', 'backyard'].includes(hus.location)) {
          hus.location = 'tea_house';
          stateChanged = true;
          console.log(`[Apply:${intent.id}] 相公王甯闻讯移步至【临江茶坊】与【${actor.name || actorId}】相见`);
        }
      }

      // 同行伴侣同步位移（支持正向相公带女眷、反向女眷带相公）
      const movedCompanions = [];
      const declinedCompanions = [];

      if (Array.isArray(intent.companions) && intent.companions.length > 0) {
        for (const comp of intent.companions) {
          const cActor = world.actors?.[comp.id];
          if (!cActor || cActor.dead) continue;

          // 判定伴侣是否同意同行：
          // 1. 若双方达成共识 (isConsensus)，直接同意
          // 2. 若 verdict 中显式指定该伴侣同意与否
          // 3. 否则根据 gate.companionsStatus 中该伴侣的 ok 判定
          let consented = true;
          if (intent.params?.isConsensus) {
            consented = true;
          } else if (verdict?.companionConsents && typeof verdict.companionConsents[comp.id] === 'boolean') {
            consented = verdict.companionConsents[comp.id];
          } else if (typeof verdict?.companionConsented === 'boolean') {
            consented = verdict.companionConsented;
          } else if (gate?.companionsStatus) {
            const st = gate.companionsStatus.find((s) => s.id === comp.id);
            if (st && st.ok === false) consented = false;
          }

          // 移动同处一室或同宅内院汇合的伴侣
          const HOME_MANSION_LOCS = ['husband_room', 'backyard', 'tea_house'];
          const isSameMansion = HOME_MANSION_LOCS.includes(oldLoc) && HOME_MANSION_LOCS.includes(cActor.location);
          const isPresent = cActor.location === oldLoc || cActor.location === actor.location || isSameMansion;

          if (consented && isPresent) {
            cActor.location = finalTargetId;
            movedCompanions.push(cActor.name || comp.id);
            stateChanged = true;
          } else {
            declinedCompanions.push(cActor.name || comp.id);
          }
        }
      }

      // 队伍 party 状态维护与更新
      if (actorId === 'husband') {
        // 脱队处理
        if (intent.params?.leaveParty) {
          if (intent.params.leaveParty === 'all') {
            removeFromParty(world, 'husband', null);
          } else {
            removeFromParty(world, 'husband', intent.params.leaveParty);
          }
          stateChanged = true;
        }
        // 新随行人员入队
        for (const comp of intent.companions || []) {
          if (movedCompanions.includes(comp.name)) {
            addToParty(world, 'husband', comp.id);
            stateChanged = true;
          }
        }
        // 队内不在场人员：记录随后赶来
        const partyIds = Array.isArray(world.party?.husband) ? world.party.husband : [];
        for (const pId of partyIds) {
          const pA = world.actors?.[pId];
          if (pA && !pA.dead && !pA.jailed && pA.location !== oldLoc && pA.location !== finalTargetId) {
            pA.activity = {
              text: `随后赶往${targetPlaceName}`,
              to: finalTargetId,
              at: world.clock?.hour || 0,
              day: world.clock?.day || 1,
            };
            stateChanged = true;
          }
        }
      } else {
        // 队员自己主动走动：自动脱离相公队伍，绝不拉拽相公
        onMemberSelfAction(world, actorId);
        stateChanged = true;
      }

      // 结算开房费用（从世界资产中真实扣除）
      if (gate?.context?.isPrivateScene && gate?.context?.cost?.silver > 0) {
        const cost = gate.context.cost.silver;
        if ((world.assets?.silver || 0) >= cost) {
          world.assets.silver = Math.round((world.assets.silver - cost) * 100) / 100;
          stateChanged = true;
          console.log(`[Apply:${intent.id}] 房费结算: 扣减白银 ${cost} 两，剩余 ${world.assets.silver} 两`);
        }
      }

      // 消费并清空待确认邀约 (缺口②)
      if (world.pendingInvitation) {
        delete world.pendingInvitation;
        stateChanged = true;
      }

      const dispName = getPlaceDisplayName(world, finalTargetId);
      const partyList = [actor.name || actorId, ...movedCompanions];
      const declinedStr = declinedCompanions.length > 0 ? ` (${declinedCompanions.join('、')}留在原地)` : '';
      console.log(`[Party] 同行名单：${partyList.join(' + ')}${declinedStr}`);
      const compStr = movedCompanions.length > 0 ? movedCompanions.join('、') : '独自一人';
      console.log(`[Move] ${actor.name || actorId} → ${dispName} (同行: ${compStr})`);

      actionEvent = {
        actionId: intent.id,
        type: 'move',
        actor: actor.name,
        from: oldLoc,
        to: dispName,
        targetId: finalTargetId,
        companions: movedCompanions,
        timestamp: Date.now(),
      };
      break;
    }

    case VERBS.INTIMATE: {
      // 闺房欢好状态真实记录
      if (verdict.intimateSuccess !== false && Array.isArray(intent.companions)) {
        for (const comp of intent.companions) {
          const cActor = world.actors?.[comp.id];
          if (cActor) {
            cActor.relations = cActor.relations || {};
            cActor.relations[actorId] = cActor.relations[actorId] || { trust: 50, grievance: 0, desire: 50 };
            const r = cActor.relations[actorId];
            r.trust = Math.min(100, (Number(r.trust) || 50) + 1);
            r.grievance = Math.max(0, (Number(r.grievance) || 0) - 5);
            r.desire = Math.min(100, (Number(r.desire) || 50) + 2);
            stateChanged = true;
          }
        }
        actionEvent = {
          actionId: intent.id,
          type: 'intimate',
          actor: actor.name,
          location: actor.location,
          timestamp: Date.now(),
        };
      }
      break;
    }

    default:
      break;
  }

  // 3. 落盘与幂等记录 (I1 单一写者)
  world.appliedActions[intent.id] = {
    time: Date.now(),
    verb: intent.verb,
    actor: actorId,
    event: actionEvent,
  };
  pruneAppliedActions(world);

  // 递增版本号 (I3 双端一致)
  world.version = (Number(world.version) || 0) + 1;

  if (dataDir) {
    saveState(dataDir, world);
  }

  console.log(`[Apply:${intent.id}] actor=${actorId} verb=${intent.verb} version=${world.version} status=applied`);

  return {
    world,
    applied: true,
    skipped: false,
    event: actionEvent,
  };
}
