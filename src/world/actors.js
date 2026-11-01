/**
 * NPC 生命线 —— 让他们自己过日子
 *
 * 铁律：引擎只记录「谁做了什么」这个事实，不替天道写台词、不指定剧情走向。
 * 具体怎么演、说些什么，仍由天道在叙述时裁定。
 */
import { nextEvent } from './state.js';

/** 稳定的字符串哈希（同一个人永远同一节奏）*/
function hash(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}

/**
 * 每隔一天，每个 NPC 按自己的目标挑一件事做，记进事件流。
 * 只处理非真人 actor；真人由用户自己决定行动。
 */
export function runNPCInitiatives(world, events) {
  const day = world.clock.day;
  const hour = world.clock.hour;
  if (hour !== 9) return; // 辰时之后各人出门办事

  for (const actor of Object.values(world.actors || {})) {
    if (!actor || actor.kind === 'human' || actor.playerControlled) continue;
    if (!Array.isArray(actor.goals) || actor.goals.length === 0) continue;

    const seed = hash(actor.id);
    if ((day + seed) % 2 !== 0) continue; // 隔天行动，免得天天刷同一条
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
