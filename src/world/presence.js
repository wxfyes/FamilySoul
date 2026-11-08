/**
 * 真人角色在线心跳（进程内）。
 *
 * 只解决一件事：AI 代演/代走时，判断这个真人此刻在不在线。
 * 在线：本人自己动、自己说；离线：AI 可代演，且只在"同一场所内同行"时允许代走。
 */

const lastSeen = new Map();
const ONLINE_MS = 2 * 60 * 1000;

export function markHumanSeen(actorId) {
  const id = String(actorId || '');
  if (id) lastSeen.set(id, Date.now());
}

export function clearHumanSeen(actorId) {
  lastSeen.delete(String(actorId || ''));
}

export function isHumanOnline(actorId, windowMs = ONLINE_MS) {
  const t = lastSeen.get(String(actorId || '')) || 0;
  return t > 0 && Date.now() - t < windowMs;
}
