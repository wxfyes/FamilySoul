/**
 * 暗号与亲密状态机 —— 契约，不是提示词
 *
 * 铁律：**只有引擎能切换状态**，模型输出不得影响状态。
 * 状态跨对话持久：昨天解禁了，今天没对暗号，她就还是端庄大娘子。
 *
 *   端庄(solemn) ──对出暗号──> 解禁(unlocked) ──表示事毕──> 端庄(solemn)
 */
import { loadState, saveState, appendEvents, nextEvent } from './state.js';
import { sceneAudience } from './scene.js';

// 只认 12345 / 123456 这种独立出现的暗号，避免误伤普通数字
const UNLOCK_RE = /(?:^|[^0-9])123456?(?:[^0-9]|$)/;
const FINISH_RE = /(?:做完了|完事了|收兵|穿衣服|擦干净|下山了|下山|打完了|结束了|歇息吧|收拾一下|好了)/;

export function detectRitual(text) {
  const t = String(text || '');
  return { unlock: UNLOCK_RE.test(t), finish: FINISH_RE.test(t) };
}

export function resolveRitualActor(world, roleName) {
  if (roleName === '傲娇助手') return 'waner';
  for (const [id, a] of Object.entries(world.actors || {})) {
    if (a?.role === roleName) return id;
  }
  return null;
}

/**
 * 根据本轮输入推进状态，并把结果写进 state.json。
 * @returns {null | {unlock:boolean, finish:boolean, actorId:string, tone:number, ritual:string}}
 */
export function prepareRitual(dataDir, { text, roleName, memberKey = 'husband' } = {}) {
  const hit = detectRitual(text);
  if (!hit.unlock && !hit.finish) return null;

  const world = loadState(dataDir);
  const actorId = resolveRitualActor(world, roleName);
  if (!actorId || !world.actors?.[actorId]) return null;

  // 公开场合铁律：只要还有别的真人在同一处，暗号一律不生效（私密绝不可外露）
  const myPlace = world.actors?.[memberKey]?.location || world.actors?.husband?.location;
  const audience = myPlace ? sceneAudience(world, myPlace, memberKey) : { isPublic: false, otherHumans: [] };
  if (hit.unlock && audience.isPublic) {
    return {
      unlock: false,
      finish: false,
      refused: true,
      reason: `同场还有 ${audience.otherHumans.map((h) => h.name).join('、')} 在场`,
      actorId,
    };
  }

  const actor = world.actors[actorId];
  actor.intimacy = actor.intimacy || { level: 2, tone: 0, lastAt: 0, ritual: 'solemn' };
  const events = [];

  if (hit.unlock) {
    actor.intimacy.ritual = 'unlocked';
    actor.intimacy.tone = 3;
    actor.intimacy.level = 4;
    actor.intimacy.since = `${world.clock.day}:${world.clock.hour}`;
    events.push(nextEvent(world, { actor: 'husband', action: 'ritual_unlock', payload: { actorId }, isPublic: false }));
  } else {
    actor.intimacy.ritual = 'solemn';
    actor.intimacy.tone = 0;
    actor.intimacy.level = 3;
    actor.intimacy.lastAt = world.clock.day;
    delete actor.intimacy.since;
    events.push(nextEvent(world, { actor: 'husband', action: 'ritual_finish', payload: { actorId }, isPublic: false }));
  }

  saveState(dataDir, world);
  appendEvents(dataDir, events);

  return { ...hit, actorId, tone: actor.intimacy.tone, ritual: actor.intimacy.ritual };
}

/**
 * 契约强制：暗号命中而回复里没有「上山打老虎」，补齐。
 * 宁可机械一拍，也不能让契约失灵。
 */
export function enforceRitualAnswer(reply, ritual) {
  if (!ritual?.unlock) return reply;
  const text = String(reply || '');
  if (text.includes('上山打老虎')) return text;
  console.warn('[Ritual] 暗号命中但天道未答契约词，已自动补齐');
  return `${text}\n……上山打老虎。`;
}
