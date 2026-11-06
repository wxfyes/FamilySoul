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
import { evaluateBedIntent, resolveBedPartner } from './bedchamber.js';

/**
 * 暗号只有一组：12345。
 * 第一次对出 → 解禁；解禁状态下再对一次 → 事毕归位。
 * 不再用任何"床笫词表"去猜——猜出来的都是误触。
 */
export function detectRitual(text) {
  const has = String(text || '').includes('12345');
  if (!has) return { unlock: false, finish: false };
  return { unlock: true, finish: false };
}

export function resolveRitualActor(world, roleName, memberKey = 'husband') {
  const self = world.actors?.[memberKey] || (memberKey === 'husband' ? world.actors?.husband : null);
  const partner = resolveBedPartner(world, memberKey, '');
  if (partner) return partner.id;

  const place = self?.location || world.actors?.husband?.location;
  // 屋里在场的主子（排除自己、死者）
  const here = Object.entries(world.actors || {}).filter(
    ([id, a]) => a && !a.dead && a.location === place && id !== memberKey
  );
  if (here.length === 1) return here[0][0];

  // 男性角色优先正妻沈婉儿，其次如夫人、通房
  if (self?.gender !== 'female') {
    const wanerInHere = here.find(([id]) => id === 'waner');
    if (wanerInHere) return 'waner';
    const yunniaInHere = here.find(([id]) => id === 'yunnia');
    if (yunniaInHere) return 'yunnia';
  }

  // 仅当屋里空无一人且角色是傲娇助手时兜底正妻
  if (roleName === '傲娇助手' && self?.gender !== 'female') return 'waner';
  for (const [id, a] of Object.entries(world.actors || {})) {
    if (a?.role === roleName && (!place || a.location === place)) return id;
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
  const actorId = resolveRitualActor(world, roleName, memberKey);
  if (!actorId || !world.actors?.[actorId]) return null;

  const myPlace = world.actors?.[memberKey]?.location || world.actors?.husband?.location;
  // 暗号只对"跟前的人"生效：人不在跟前，一律不结算
  if (world.actors?.[actorId]?.location !== myPlace) {
    console.warn(`[Ritual] ${world.actors?.[actorId]?.name || actorId} 不在跟前，暗号不作数`);
    return null;
  }
  // 遵循军规第八条：物理挪移全由客户端交互控制，暗号欢好就地在当前榻上展开，绝不在聊天中偷听瞬移
  const audience = myPlace ? sceneAudience(world, myPlace, memberKey) : { isPublic: false, otherHumans: [] };
  if (hit.unlock && audience.isPublic) {
    return {
      unlock: false,
      finish: false,
      actorId,
      tone: 0,
      ritual: 'solemn',
      refused: true,
      reason: 'public_place',
      otherHumans: audience.otherHumans,
    };
  }

  const target = world.actors[actorId];
  target.intimacy = target.intimacy || { level: 0, tone: 0, lastAt: 0, ritual: 'solemn' };

  // 已经解禁的人，再对一次 12345 就是"事毕"
  if (hit.unlock && target.intimacy.ritual === 'unlocked') {
    target.intimacy.ritual = 'solemn';
    target.intimacy.tone = target.intimacy.level >= 2 ? 1 : 0;
    saveState(dataDir, world);
    return { unlock: false, finish: true, actorId, tone: target.intimacy.tone, ritual: 'solemn' };
  }

  if (hit.unlock) {
    target.intimacy.ritual = 'unlocked';
    target.intimacy.tone = 3;
    target.intimacy.lastAt = world.clock?.day || 1;
    saveState(dataDir, world);
    return { unlock: true, finish: false, actorId, tone: 3, ritual: 'unlocked' };
  }

  if (hit.finish) {
    target.intimacy.ritual = 'solemn';
    target.intimacy.tone = target.intimacy.level >= 2 ? 1 : 0;
    saveState(dataDir, world);
    return { unlock: false, finish: true, actorId, tone: target.intimacy.tone, ritual: 'solemn' };
  }

  return null;
}
/**
 * 契约强制：暗号命中而回复里没有「上山打老虎」，补齐。
 * 宁可机械一拍，也不能让契约失灵。
 * 铁律：只有女性内眷（沈婉儿/芸娘/小翠）在相公发起暗号时才对答，糙汉丈夫（如于子归）绝不得误答！
 */
export function enforceRitualAnswer(reply, ritual) {
  if (!ritual?.unlock) return reply;
  const aid = String(ritual?.actorId || '');
  if (aid === 'npc_2' || aid === 'husband' || aid === 'suike' || /于子归|于杰|随科/.test(aid)) return reply;
  const text = String(reply || '');
  if (text.includes('上山打老虎')) return text;
  console.warn('[Ritual] 暗号命中但天道未答契约词，已自动补齐');
  return `${text}\n……上山打老虎。`;
}
