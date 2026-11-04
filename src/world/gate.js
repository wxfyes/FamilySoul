/**
 * Gate 合法性门禁模块 —— 七层管道的第二层
 * 
 * 职责：
 * 1. 纯函数，绝对不调用大模型，绝对不写任何 state。
 * 2. 集中校验：在场？身份？资源/银两？地方存在？同行同意基础？
 * 3. 产出结构化判定结果：{ ok, blocked, reasons, alternatives, companionsStatus, context }
 * 4. 严格匹配真实账本字段：relations[actor].grievance / activity.text / places[id].name
 */

import { VERBS, isValidPlaceName } from './intent.js';

/**
 * 获取地点的真实中文名
 * @param {object} world 
 * @param {string} locId 
 * @returns {string}
 */
export function getPlaceDisplayName(world, locId) {
  if (!locId) return '未知之地';
  if (world?.places?.[locId]?.name) return world.places[locId].name;
  for (const [, p] of Object.entries(world?.places || {})) {
    if (p?.id === locId && p.name) return p.name;
  }
  return String(locId);
}

/**
 * 校验地点是否存在于已知世界中（严格从 world.places 与 properties 动态查询，绝不硬编码）
 * @param {object} world 
 * @param {string} targetName 
 * @returns {{ exists: boolean, placeId: string|null, place: object|null }}
 */
export function findTargetPlace(world, targetName) {
  if (!targetName || !isValidPlaceName(targetName)) {
    return { exists: false, placeId: null, place: null };
  }
  const clean = String(targetName).trim();

  // 1. 从 world.places 动态匹配
  if (world?.places) {
    // 精确 id 或 name 命中
    if (world.places[clean]) {
      return { exists: true, placeId: clean, place: world.places[clean] };
    }
    for (const [pId, p] of Object.entries(world.places)) {
      const pName = String(p?.name || '');
      if (pId === clean || pName === clean || pName.includes(clean) || clean.includes(pName)) {
        return { exists: true, placeId: pId, place: p };
      }
    }
  }

  // 2. 从 world.assets.properties 动态匹配
  if (Array.isArray(world?.assets?.properties)) {
    for (const prop of world.assets.properties) {
      const propName = String(prop?.name || '');
      if (propName === clean || propName.includes(clean) || clean.includes(propName)) {
        return { exists: true, placeId: prop.place || prop.id, place: prop };
      }
    }
  }

  return { exists: false, placeId: null, place: null };
}

/**
 * 门禁校验核心纯函数
 * @param {object} world 当前世界状态快照（真实数据结构）
 * @param {object} intent 标准 Intent 对象
 * @returns {object} 门禁校验报告
 */
export function checkGate(world = {}, intent = {}) {
  const reasons = [];
  const alternatives = [];
  let blocked = false;
  let ok = true;
  const companionsStatus = [];
  const context = {
    targetExists: false,
    targetPlaceId: null,
    targetPlace: null,
    cost: { silver: 0, copper: 0 },
    canAfford: true,
    isPrivateScene: false,
    companionsOk: true,
  };

  const actorId = intent.actor || 'husband';
  const actor = world?.actors?.[actorId] || world?.actors?.husband;

  // 1. 发起者基本合法性校验
  if (!actor) {
    return {
      ok: false,
      blocked: true,
      reasons: [`发起者【${actorId}】在世界中不存在`],
      alternatives: ['核对发起者身份'],
      companionsStatus,
      context,
    };
  }
  if (actor.dead) {
    return {
      ok: false,
      blocked: true,
      reasons: [`【${actor.name || actorId}】已身故，不可再行动`],
      alternatives: ['天道轮回'],
      companionsStatus,
      context,
    };
  }

  // 取出发起者当前的真实中文地名
  const curLocId = actor.location || 'husband_room';
  const curLocName = getPlaceDisplayName(world, curLocId);

  // 2. 分动词校验
  switch (intent.verb) {
    case VERBS.MOVE: {
      const targetName = intent.target;
      if (!targetName || !isValidPlaceName(targetName)) {
        ok = false;
        blocked = true;
        reasons.push('欲行移步，但未指明合法目的地');
        alternatives.push('指定欲往何处，如"去回春堂药铺"、"去茶坊"');
        break;
      }

      // 地点存在性动态校验
      const { exists, placeId, place } = findTargetPlace(world, targetName);
      context.targetExists = exists;
      context.targetPlaceId = placeId;
      context.targetPlace = place;

      if (!exists) {
        alternatives.push(`世上暂无"${targetName}"，可由天道或相公就地辟建造景`);
      }

      // 开房 / 住店资源门禁（真实价格：上房 3 两，通铺 2 钱）
      const isUpRoom = /(上房|天字)/.test(targetName);
      const isLodging = isUpRoom || /(客房|客栈|开房|歇宿|通铺)/.test(targetName);
      if (isLodging) {
        context.isPrivateScene = true;
        context.cost.silver = isUpRoom ? 3 : 0.2; // 上房3两，通铺2钱
        const totalSilver = Number(world?.assets?.silver || 0);
        if (totalSilver < context.cost.silver) {
          context.canAfford = false;
          reasons.push(`客栈${isUpRoom ? '上房需银三两' : '房钱需银二钱'}，当前手头仅存白银${totalSilver}两，盘缠不足`);
          alternatives.push('先回茶坊柜台取银，或向掌柜赊账开房');
        }
      }

      // 同行者合法性门禁（真实字段校验：location, relations[actor].grievance, activity.text）
      if (Array.isArray(intent.companions) && intent.companions.length > 0) {
        for (const comp of intent.companions) {
          const cActor = world?.actors?.[comp.id];
          if (!cActor) {
            companionsStatus.push({ id: comp.id, name: comp.name, ok: false, reason: '此人不在人世' });
            reasons.push(`同行者【${comp.name}】不知所踪`);
            context.companionsOk = false;
            continue;
          }

          // ① 同处一室或同宅内院汇合判定（正房、后院暖阁、茶坊同属主宅院，相公唤一声即可汇合启程）
          const HOME_MANSION_LOCS = ['husband_room', 'backyard', 'tea_house'];
          const isSameMansion = HOME_MANSION_LOCS.includes(curLocId) && HOME_MANSION_LOCS.includes(cActor.location);

          if (cActor.location !== curLocId && !isSameMansion) {
            const compLocName = getPlaceDisplayName(world, cActor.location);
            companionsStatus.push({
              id: comp.id,
              name: cActor.name,
              ok: false,
              notPresent: true,
              reason: `此刻身处【${compLocName}】，并不在【${curLocName}】`,
            });
            reasons.push(`同行者【${cActor.name}】此刻在【${compLocName}】，并不在【${curLocName}】，无法一同启程`);
            alternatives.push(`先移步前往【${compLocName}】找寻${cActor.name}，或独自前往【${targetName}】`);
            context.companionsOk = false;
            continue;
          }

          // 若双方已达成共识（对方此前已提前邀约，相公应允“好/走吧”），直接同行转场 (流程图左分支)
          if (intent.params?.isConsensus) {
            companionsStatus.push({
              id: comp.id,
              name: cActor.name,
              ok: true,
              consensus: true,
              reason: '此前已主动相邀，如今得相公应允，欣然相随转场',
            });
            continue;
          }

          // ② 真实关系字段校验：cActor.relations[actorId].grievance & trust
          const rel = cActor.relations?.[actorId] || cActor.relations?.husband || {};
          const grievance = Number(rel.grievance || 0);
          const trust = Number(rel.trust || 0);

          // ③ 真实 activity.text 校验
          const busyText = typeof cActor.activity === 'object' ? String(cActor.activity?.text || '') : String(cActor.activity || '');

          if (grievance >= 40) {
            companionsStatus.push({
              id: comp.id,
              name: cActor.name,
              ok: false,
              reason: `心怀怨气（怨气值${grievance}），神色冷淡推辞`,
            });
            reasons.push(`${cActor.name}心中怨气未消（怨气值${grievance}），不愿与你同行`);
            alternatives.push(`先温存好生安抚${cActor.name}，消解怨气`);
            context.companionsOk = false;
          } else if (busyText && /(核账|看账|查账|守店|熬药|待客|问诊|备货)/.test(busyText)) {
            companionsStatus.push({
              id: comp.id,
              name: cActor.name,
              ok: false,
              reason: `手头有差事【${busyText}】未了`,
            });
            reasons.push(`${cActor.name}手头正忙着【${busyText}】，一时脱不开身`);
            alternatives.push(`让${cActor.name}先安心料理活计，稍后再聚`);
          } else if (isLodging && (cActor.id === 'waner' || cActor.name === '沈婉儿')) {
            // 正妻沈婉儿的名分顾虑
            companionsStatus.push({
              id: comp.id,
              name: cActor.name,
              ok: true,
              hesitant: true,
              reason: '正妻堂堂大娘子，出入客栈开房有失体面，颇多羞赧顾忌',
            });
          } else {
            companionsStatus.push({ id: comp.id, name: cActor.name, ok: true, reason: '欣然依从同行' });
          }
        }
      }

      if (reasons.length > 0 && !context.canAfford) {
        ok = false;
        blocked = true;
      }
      break;
    }

    case VERBS.INTIMATE: {
      context.isPrivateScene = true;
      const HOME_MANSION = ['husband_room', 'backyard', 'tea_house'];
      const isActorInHome = HOME_MANSION.includes(curLocId);

      // 检查当前地点或主宅同场是否有伴侣同在
      const companionsInRoom = [];
      const companionsInMansion = [];
      if (world?.actors) {
        for (const [id, a] of Object.entries(world.actors)) {
          if (!a || a.dead || id === actorId) continue;
          if (a.location === curLocId) {
            companionsInRoom.push(a);
          } else if (isActorInHome && HOME_MANSION.includes(a.location)) {
            companionsInMansion.push(a);
          }
        }
      }

      // 如果当前正在解禁欢好（unlocked），或者同屋有人，或者在主宅且宅内有妻妾在场：
      const isRitualUnlocked = Object.values(world?.actors || {}).some((a) => a?.intimacy?.ritual === 'unlocked');
      const hasPartnerPresent = companionsInRoom.length > 0 || isRitualUnlocked || (isActorInHome && companionsInMansion.length > 0);

      if (!hasPartnerPresent) {
        ok = false;
        blocked = true;
        reasons.push(`当前所在【${curLocName}】并无女眷在场`);
        alternatives.push('先唤佳人前来说话，或前往佳人所在处');
      } else {
        // 场所隐秘性：大庭广众不可露骨
        const isPublic = /(码头|大街|官道|大堂|公堂|衙门|集市|书院|牢)/.test(curLocName) ||
                         ['street', 'yamen', 'canal_dock', 'academy', 'jail_male', 'jail_female'].includes(curLocId);
        if (isPublic && !isRitualUnlocked) {
          reasons.push(`当前身处【${curLocName}】广庭大众之所，众目睽睽之下行房有伤风化`);
          alternatives.push('移步至后院暖阁或客栈上房再叙鱼水之欢');
        }
      }
      break;
    }

    case VERBS.TRADE:
    case VERBS.REPORT:
    case VERBS.COURT:
    case VERBS.CHAT:
    default: {
      ok = true;
      break;
    }
  }

  return {
    ok,
    blocked,
    reasons,
    alternatives,
    companionsStatus,
    context,
  };
}
