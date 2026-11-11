/**
 * NPC 生命线 —— 让他们自己过日子，并且真的影响世界
 *
 * 铁律：
 *  1. 引擎只改数值与事实（钱、关系、暗涌），**不写台词**；
 *  2. 所有改动都夹紧上下限，出错只当"没发生"，绝不影响对话；
 *  3. 每个 NPC 的效果与他的目标挂钩，不是随机撒数值。
 */
import { nextEvent } from './state.js';

/** 稳定的字符串哈希（同一个人永远同一节奏）*/
function hash(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function bumpRelation(actor, field, delta) {
  const rel = actor?.relations?.husband;
  if (!rel || typeof rel[field] !== 'number') return false;
  rel[field] = clamp(rel[field] + delta, 0, 100);
  return true;
}

/**
 * 产业收入按「比例」增长，不再有「日入 3 两封顶」这种拍脑袋的天花板。
 * 生意做多大，日入就多大——没有上限（只保证非负）。
 */
function growIncome(world, propertyId, pct) {
  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
  const p = props.find((x) => x.id === propertyId) || props[0];
  if (!p) return null;
  const cur = Number(p.incomePerDay) || 0;
  const base = cur > 0 ? cur : 0.5; // 还没开张的产业，先按最低营收起步
  // 不设上限：现实世界没有封顶。只保证非负。
  p.incomePerDay = Math.round(Math.max(0, base * (1 + pct)) * 100) / 100;
  return { name: p.name, income: p.incomePerDay };
}

function addPending(world, item) {
  world.pending = Array.isArray(world.pending) ? world.pending : [];
  if (world.pending.some((p) => p && p.id === item.id)) return false;
  world.pending.push(item);
  if (world.pending.length > 8) world.pending = world.pending.slice(-8);
  return true;
}

/** 让这次行动真的改动世界；返回改了什么的描述（给日志用）*/
function applyNpcEffect(world, actor, events, queuePush) {
  const day = world.clock.day;
  const changes = [];

  switch (actor.id) {
    case 'qiantonghai': {
      // 反派：怨气渐长，隔几日就真的压价收茶
      bumpRelation(actor, 'grievance', 2);
      if (day % 5 === 0) {
        const ok = addPending(world, {
          id: `qth_price_${day}`,
          desc: '钱通海在茶市压价收茶，茶农不敢卖给咱们，茶坊进货价被抬了',
          due: day + 2,
          severity: 2,
          effects: [
            { type: 'silver', delta: -6 },
            { type: 'relation', target: 'waner', field: 'grievance', delta: 3 },
          ],
        });
        if (ok) {
          changes.push('压价收茶（暗涌）');
          events.push(
            nextEvent(world, {
              action: 'npc_effect',
              actor: actor.id,
              place: actor.location,
              payload: { text: '钱通海在茶市压价收茶，茶坊进货价被抬' },
              isPublic: true,
            }),
          );
          queuePush?.({
            reason: 'event',
            facts: { desc: '钱通海在茶市压价收茶，咱们的进货价被抬了' },
            force: true,
          });
        }
      }
      break;
    }

    case 'waner': {
      // 正妻掌家：茶坊日入稳步上涨，信任缓慢累积
      bumpRelation(actor, 'trust', 1);
      const g = growIncome(world, 'tea_house', 0.012);
      if (g) changes.push(`${g.name}日入→${g.income}两`);
      break;
    }

    case 'yunnia': {
      // 二房学看柜：柜上生意渐熟
      bumpRelation(actor, 'trust', 1);
      const g = growIncome(world, 'tea_house', 0.015);
      if (g) changes.push(`${g.name}日入→${g.income}两`);
      if (day % 3 === 0) {
        queuePush?.({
          speaker: '二房·芸娘',
          to: 'husband',
          reason: 'wife_care',
          facts: {
            who: '林芸娘',
            role: '二房如夫人',
            topic: '茶坊近来流水颇稳，芸娘新做了桂花糕，请相公品尝'
          },
          fallback: '【二房·芸娘】：相公，柜台这几日的账目妾身已理清了，日入平稳。方才灶上新蒸了桂花茶糕，妾身差小翠给相公端过去趁热尝尝，看可合相公胃口？',
          force: true,
        });
      }
      break;
    }

    case 'yangcaiyun':
    case 'liuwenxia':
    case 'zhanjing': {
      // 暗线情报：每隔几日送来一条可用风声
      bumpRelation(actor, 'desire', 1);
      if ((day + hash(actor.id)) % 3 === 0) {
        const intel =
          actor.id === 'yangcaiyun'
            ? '杨采云递话：翟家货栈这批货压了三成价，月底前能走水路便宜进茶'
            : actor.id === 'liuwenxia'
              ? '刘文霞递话：城南几家酒肆都在等咱们酒楼的酒，肯出高价'
              : '战静递话：县衙那边茶税的新例还没定死，托人还能缓一缓';
        changes.push('递来一条情报');
        events.push(
          nextEvent(world, {
            action: 'npc_intel',
            actor: actor.id,
            place: actor.location,
            payload: { text: intel },
            isPublic: true,
          }),
        );
        if (actor.id === 'liuwenxia') {
          queuePush?.({
            speaker: '老板娘·紫嫣',
            to: 'husband',
            reason: 'npc_intel',
            facts: {
              who: '紫嫣',
              role: '于家酒肆老板娘',
              intel: '城南几家酒肆掌柜打听运河大酒楼的存酒，肯出高价'
            },
            fallback: '【老板娘·紫嫣】：相公，城南几家酒肆掌柜今早托人来我铺子里打听，说想高价匀咱们运河大酒楼的存酒，妾身没敢擅自应下，特差伙计来递个口信，看相公如何示下？',
            force: true,
          });
        } else if (actor.id === 'zhanjing') {
          queuePush?.({
            speaker: '发妻·静儿',
            to: 'husband',
            reason: 'npc_intel',
            facts: {
              who: '战静',
              role: '县衙书吏发妻',
              intel: '县衙新茶税知县尚未画押，托相熟老吏还能缓几天'
            },
            fallback: '【发妻·静儿】：夫君，静儿在衙门听到些风声，新茶税的册子知县还没画押，托相熟的老吏递个话还能缓上几天，夫君心里好有个准备。',
            force: true,
          });
        } else if (actor.id === 'yangcaiyun') {
          queuePush?.({
            speaker: '货栈老板娘·采云',
            to: 'husband',
            reason: 'npc_intel',
            facts: {
              who: '杨采云',
              role: '翟家货栈老板娘',
              intel: '翟家货栈新到两淮客船，月底前走水路头春茶可压三成价'
            },
            fallback: '【货栈老板娘·采云】：王东家，翟家货栈新到了两淮的客船，东家若是还要进头春毛尖，月底前走水路我能替您压三成价，您若有心，差人来货栈支会一声便是。',
            force: true,
          });
        }
      }
      break;
    }

    case 'sunjin': {
      // 临江客栈掌柜：经营顺遂时晨间向东家请安禀报
      if ((day + hash(actor.id)) % 4 === 0) {
        queuePush?.({
          speaker: '客栈掌柜·孙进',
          to: 'husband',
          reason: 'business_report',
          facts: {
            who: '孙进',
            role: '临江客栈掌柜',
            topic: '客栈上房客满，向东家回禀早安'
          },
          fallback: '【客栈掌柜·孙进】：王东家，昨夜两淮客商把天字上房全包下了，柜上银钱点清妥当。孙进给东家请早安，今日若得空，请东家来店里坐坐品茶！',
          force: true,
        });
      }
      break;
    }

    case 'yangzhenhua': {
      // 知府千金：偶尔牵出官府风向
      if (day % 6 === 0) {
        const ok = addPending(world, {
          id: `yzh_yamen_${day}`,
          desc: '知府衙门要重核茶税，杨大小姐递话让咱们早做准备',
          due: day + 3,
          severity: 2,
          effects: [{ type: 'silver', delta: -4 }],
        });
        if (ok) {
          changes.push('官税暗涌');
          events.push(
            nextEvent(world, {
              action: 'npc_effect',
              actor: actor.id,
              place: actor.location,
              payload: { text: '知府衙门要重核茶税' },
              isPublic: true,
            }),
          );
          queuePush?.({
            speaker: '知府千金·采儿',
            to: 'husband',
            reason: 'official_intel',
            facts: {
              who: '杨采儿',
              role: '知府千金',
              intel: '衙门正商议整肃两淮茶税，大小姐遣侍女暗中提醒'
            },
            fallback: '【知府千金·采儿】：王少掌柜，我爹在签押房正与通判商议茶税重厘之事，我特让侍女给你递个私信，你这几日的账目契纸还需做扎实些，莫让人拿了短处。',
            force: true,
          });
        }
      }
      break;
    }

    default:
      break;
  }

  return changes;
}

/**
 * 每隔一天，每个 NPC 按自己的目标挑一件事做，并让它产生真实后果。
 * 只处理非真人 actor；真人由用户自己决定行动。
 * @param {(opts:object)=>void} [queuePush] 可选：由调用方注入的主动推送队列
 */
export function runNPCInitiatives(world, events, queuePush) {
  const day = world.clock.day;
  const hour = world.clock.hour;
  if (hour !== 9) return;

  for (const actor of Object.values(world.actors || {})) {
    if (!actor || actor.kind === 'human' || actor.playerControlled) continue;
    if (!Array.isArray(actor.goals) || actor.goals.length === 0) continue;

    const seed = hash(actor.id);
    if ((day + seed) % 2 !== 0) continue;
    // 外城百工人多，事件再稀释一档（按出身类别，不是个案）
    if (actor.origin === 'city_base' && (day + seed) % 5 !== 0) continue;
    if (actor.lastAct?.day === day) continue;

    const goal = actor.goals[(day + seed) % actor.goals.length];
    actor.lastAct = { day, goal };

    events.push(
      nextEvent(world, {
        action: 'npc_act',
        actor: actor.id,
        place: actor.location,
        payload: { goal, name: actor.name },
        isPublic: true,
      }),
    );

    // 行动产生真实后果（失败也只是跳过，不影响对话）
    try {
      const changes = applyNpcEffect(world, actor, events, queuePush);
      if (changes.length > 0) {
        console.log(`[NPC] ${actor.name}：${changes.join('、')}`);
      }
    } catch (err) {
      console.warn(`[NPC] ${actor.name} 行动结算失败：`, err.message);
    }
  }
}

/** 最近几天 NPC 都在忙什么（给天机摘要用，只给事实，不给台词）*/
export function recentActivities(world, withinDays = 2) {
  const day = world.clock.day;
  const list = [];
  for (const actor of Object.values(world.actors || {})) {
    const act = actor?.lastAct;
    if (!act || !act.goal) continue;
    if (day - Number(act.day) > withinDays) continue;
    list.push({ name: actor.name, goal: act.goal, day: act.day });
  }
  return list.sort((a, b) => b.day - a.day).slice(0, 4);
}

/** 统一角色标识解析器，消除历史别名与错别字隐患 */
export function normalizeActorId(id) {
  if (!id) return id;
  const str = String(id).trim();
  if (str === 'yunniang') return 'yunnia';
  return str;
}
