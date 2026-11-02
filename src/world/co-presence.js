/**
 * 真人同场 —— 两个真人在同一个地方，说的话互相看得见
 *
 * 规则：
 *   1. 真人的话由他本人说，AI 只演 NPC，绝不替任何真人发言；
 *   2. 同一地点的真人，消息互相投递（落进对方的聊天记录 + 推送）；
 *   3. 场景消息只留最近 50 条，避免越堆越大。
 */
import fs from 'node:fs';
import path from 'node:path';

function sceneFile(dataDir) {
  return path.join(dataDir, 'world', 'scenes.json');
}

export function loadScenes(dataDir) {
  try {
    const raw = fs.readFileSync(sceneFile(dataDir), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveScenes(dataDir, scenes) {
  try {
    fs.mkdirSync(path.join(dataDir, 'world'), { recursive: true });
    fs.writeFileSync(sceneFile(dataDir), JSON.stringify(scenes, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Scene] 场景存档失败：', err.message);
  }
}

/** 记一条真人发言 */
export function recordHumanLine(dataDir, placeId, actorId, name, text) {
  if (!placeId || !actorId || !String(text || '').trim()) return;
  const scenes = loadScenes(dataDir);
  const list = Array.isArray(scenes[placeId]) ? scenes[placeId] : [];
  list.push({ actorId, name, text: String(text).slice(0, 400), at: Date.now() });
  scenes[placeId] = list.slice(-50);
  saveScenes(dataDir, scenes);
}

/** 同一个地点、除自己以外的真人 */
export function otherHumansAt(world, placeId, selfActorId) {
  if (!placeId) return [];
  return Object.values(world.actors || {}).filter(
    (a) => a && !a.dead && a.kind === 'human' && a.id !== selfActorId && a.location === placeId,
  );
}

/** 代读 server 的成员映射：actorId -> 成员 key */
export function memberKeyOfActor(rootDir, actorId) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(rootDir, 'config.json'), 'utf8'));
    for (const [key, profile] of Object.entries(cfg?.family || {})) {
      if (profile?.actor === actorId) return key;
    }
  } catch {
    /* 忽略 */
  }
  return null;
}
