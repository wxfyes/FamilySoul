/**
 * 每个人今天想做什么：不是剧本，是他自己的打算。
 *
 * 规矩：
 *   ① 目标从"他是谁、手里有什么、城里出什么事"推出来，不写死；
 *   ② 目标会被推进、会成、会败、会改主意；
 *   ③ 引擎只给"他想做什么"，怎么说、做不做，交给天道与他自己的处境。
 */

import { materializeRoom } from './residence.js';
import { moveActor } from './position.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 按身份/处境给一个今日目标（没有就返回 null，不硬塞） */
export function makeGoal(world, actor) {
  if (!actor || actor.dead || actor.jailed) return null;
  const home = world.places?.[actor.home];
  const hour = num(world.clock?.hour);
  const props = (world.assets?.properties || []).filter((p) => p && String(p.keeper || '') === String(actor.id));
  const role = String(actor.title || actor.role || '');

  // 有铺子在管的：理货、催账、应酬
  if (props.length) {
    const p = props[Math.floor(Math.random() * props.length)];
    const kind = Math.random();
    if (kind < 0.45) return { kind: 'tend', text: `去${p.name}看看今天的进出`, place: p.place || null, due: hour + 3 };
    if (kind < 0.75) return { kind: 'collect', text: `去${p.name}催一笔旧账`, place: p.place || null, due: hour + 4 };
    return { kind: 'social', text: '去码头/街面上应酬一圈，探探行情', place: 'street', due: hour + 5 };
  }

  // 门房/差事在身的
  if (actor.duty?.post === 'gate') return { kind: 'duty', text: '在门房当值，等有人来', place: home?.rooms?.gate?.id || null, due: hour + 4 };

  // 家眷：管中馈、看账、上香、走亲、买办
  if (actor.household) {
    const pool = [
      { kind: 'home', text: '在中堂理事，看看这几日的中人回话', place: home?.rooms?.hall?.id || null },
      { kind: 'home', text: '去账房核一核本月的进出', place: home?.rooms?.account?.id || null },
      { kind: 'home', text: '去后花园走走，透口气', place: home?.rooms?.garden?.id || null },
      { kind: 'market', text: '上街买些时新果子与针线', place: 'street' },
      { kind: 'shrine', text: '去祠堂上炷香，替家里求个平安', place: home?.rooms?.shrine?.id || null },
    ];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { ...pick, due: hour + 3 };
  }

  // 摊贩：出摊、进货
  if (actor.stall) {
    return Math.random() < 0.8
      ? { kind: 'stall', text: `挑担出摊，卖${actor.stall.word || '货'}`, place: 'street', due: hour + 4 }
      : { kind: 'restock', text: '去货栈进点货，明日好卖', place: 'street', due: hour + 3 };
  }

  // 其他人：做点自己的事
  const generic = [
    { kind: 'wander', text: '在街上转转，看看有什么活计', place: 'street' },
    { kind: 'rest', text: '回住处歇一歇', place: actor.home || null },
  ];
  if (Math.random() < 0.4) return { ...generic[Math.floor(Math.random() * generic.length)], due: hour + 3 };
  if (role && Math.random() < 0.3) return { kind: 'work', text: `照常做${role}的营生`, place: actor.location || null, due: hour + 4 };
  return null;
}

/** 每人每天重新想一遍（一天一次，别每时辰乱换） */
export function refreshGoals(world) {
  const day = num(world.clock?.day) || 1;
  world.flags = world.flags || {};
  world.flags.goalDay = world.flags.goalDay || 0;
  if (num(world.flags.goalDay) === day) return 0;
  let n = 0;
  for (const a of Object.values(world?.actors || {})) {
    if (!a || a.dead || a.jailed) continue;
    if (String(a.id).startsWith('usr_') || a.id === 'husband' || a.humanBound) continue;   // 真人的事由玩家自己定
    const g = makeGoal(world, a);
    if (g) { a.goal = { ...g, sinceDay: day }; n += 1; }
    else delete a.goal;
  }
  world.flags.goalDay = day;
  return n;
}

/**
 * 推进目标：到点就去做，做完写结果
 * @returns {number} 动了几个
 */
export function pursueGoals(world) {
  const hour = num(world.clock?.hour);
  let n = 0;
  for (const a of Object.values(world?.actors || {})) {
    if (!a || a.dead || a.jailed || !a.goal) continue;
    if (a.awayUntil) continue;
    const g = a.goal;
    // 目标地点没展开/没写，就按他的身份给一处该去的地方
    if (!g.place) {
      const home = world.places?.[a.home];
      if (a.household && home) {
        // 目标房间平时只记在账上，先展开再走（否则会算成"原地不动"）
        for (const key of ['hall', 'garden', 'shrine', 'account', 'reception']) {
          if (!home.rooms?.[key]) continue;
          const made = materializeRoom(world, home.id, key);
          if (made && world.places?.[made]) { g.place = made; break; }
        }
      }
      if (!g.place) g.place = a.location || 'street';
    }
    if (g.place && String(g.place).includes('__') && !world.places?.[g.place]) {
      const [pid, key] = String(g.place).split('__');
      const made = materializeRoom(world, pid, key);
      g.place = (made && world.places?.[made]) ? made : null;
    }
    if (!g.place || !world.places?.[g.place]) {
      const home = world.places?.[a.home];
      g.place = home?.rooms?.hall?.id || home?.rooms?.garden?.id || 'street';
    }
    if (g.place && g.place !== a.location && hour <= num(g.due)) {
      const mv = moveActor(world, a.id, g.place, 'world', '办自己的事');
      if (!mv?.ok) console.log(`[Goal] ${a.name} 没走成：${mv?.error || '未知'}（去${g.place}）`);
      if (mv?.ok) { a.activity = { text: g.text, at: hour, day: num(world.clock?.day) || 1 }; n += 1; }
    }
    // 到期：成或不成，都记下来
    if (hour >= num(g.due)) {
      const ok = Math.random() < 0.6;
      a.lastGoal = { text: g.text, day: num(world.clock?.day) || 1, ok };
      delete a.goal;
      n += 1;
    }
  }
  return n;
}
