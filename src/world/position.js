/**
 * 位置：全世界只有这里能改人的所在地。
 *
 * 为什么要有这一层：
 *   以前时钟、场景同步、自愈、命令各写各的，玩家会莫名其妙被搬走。
 *   现在所有移动都走 moveActor()，它只认两种理由：
 *     - 'ui'    ：玩家自己在界面上点的（他要去哪儿/叫人过来）
 *     - 'world' ：世界自己在动（作息、自愈、差事）
 *   真人登着的角色（humanBound）只接受 'ui'，其它一律拒绝。
 */

export const MOVE_REASONS = new Set(['ui', 'world']);

function humanBoundSet(world) {
  const s = new Set();
  if (Array.isArray(world?.flags?.humanActors)) for (const id of world.flags.humanActors) s.add(String(id));
  for (const [id, a] of Object.entries(world?.actors || {})) if (a?.humanBound) s.add(id);
  return s;
}

export function isHumanBound(world, actorId) {
  return humanBoundSet(world).has(String(actorId));
}

export function moveActor(world, actorId, placeId, reason = 'world', note = '') {
  if (!MOVE_REASONS.has(reason)) return { ok: false, error: '未知的移动理由' };
  const a = world?.actors?.[actorId];
  if (!a || a.dead) return { ok: false, error: '没有这个人' };
  if (!placeId || !world.places?.[placeId]) return { ok: false, error: '没有这个地点' };
  if (a.location === placeId) return { ok: true, moved: false };

  // 真人登着的角色：只有他自己点界面才动
  // 真人角色不能被别人随意搬；但主人当面送客（note 带"送客"）是明确的离场指令
  // 自己的打算、自己的走动、主人当面送客——都算"自己走"，真人绑定也放行
  const selfMove = /办自己的事|自己走动|送客|通禀允入/.test(String(note || ''));
  if (isHumanBound(world, actorId) && reason !== 'ui' && !selfMove) {
    return { ok: false, error: '真人角色不接受世界移动' };
  }

  // 刚被主人请走的人：几个时辰内不许自己回来（送客本人除外）
  try {
    const aw = a.awayUntil;
    if (aw && !String(note || '').includes('送客')) {
      const day = Number(world.clock?.day) || 1;
      const hour = Number(world.clock?.hour) || 0;
      const until = Number(aw.day) === day ? Number(aw.hour) : (Number(aw.day) > day ? 99 : hour);
      if (until > hour) return { ok: false, error: '刚被请走，暂不回来' };
      delete a.awayUntil;
    }
  } catch { /* 忽略 */ }

  // 在押犯人：服刑期间严禁常规走动与作息闲逛，只能在狱中或提审
  if (a.jailed && !/(jail|牢|大牢)/.test(placeId) && !String(note || '').startsWith('刑满') && reason !== 'admin') {
    return { ok: false, error: '在押犯人不可自由移出监牢' };
  }

  const from = a.location || null;
  a.location = placeId;
  a.lastMove = { from, to: placeId, by: reason, note: String(note || '').slice(0, 30), day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
  return { ok: true, moved: true, from, to: placeId };
}
