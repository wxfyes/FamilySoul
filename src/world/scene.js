/**
 * 同场与偶遇 —— 开放世界的最小实现
 *
 * 不是"群聊房间"，而是"谁站在同一个地方，谁就看得见彼此"。
 * 单进程 Node 天然串行，不需要数据库，也不需要锁。
 */
import path from 'node:path';
import fs from 'node:fs';
import { loadState, saveState, shichenOf } from './state.js';

const SCENE_DIRNAME = 'scene';

function sceneDir(dataDir) {
  return path.join(dataDir, 'chat', SCENE_DIRNAME);
}
function sceneFile(dataDir, placeId) {
  return path.join(sceneDir(dataDir), `${String(placeId).replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
}

/** 人类成员也是 actor：首次出现时建号，落进同一张人物表 */
export function ensureHumanActor(world, memberKey, profile = {}) {
  if (!memberKey) return null;
  const existing = world.actors?.[memberKey];
  if (existing) {
    existing.kind = 'human';
    existing.playerControlled = true;
    return existing;
  }
  world.actors = world.actors || {};
  world.actors[memberKey] = {
    id: memberKey,
    name: profile.title || memberKey,
    role: profile.role || '访客',
    kind: 'human',
    playerControlled: true,
    // 默认地点：相公在茶坊，其余人从长街来（避免一上线就"同场"，私聊被误判为公开）
    location: profile.place || (memberKey === 'husband' ? 'tea_house' : 'street'),
    relations: {},
    intimacy: {},
    lastSeenAt: Date.now(),
  };
  return world.actors[memberKey];
}

/** 成员首次出现时登记位置（已有则不动）*/
export function ensurePresence(dataDir, memberKey, profile = {}) {
  const world = loadState(dataDir);
  if (world.actors?.[memberKey]) return world.actors[memberKey];
  ensureHumanActor(world, memberKey, profile);
  saveState(dataDir, world);
  return world.actors[memberKey];
}

/** 移动到某个地点 */
export function moveMember(dataDir, memberKey, placeId, profile = {}) {
  const world = loadState(dataDir);
  const actor = ensureHumanActor(world, memberKey, profile);
  if (!actor) return null;
  if (!world.places?.[placeId]) return null;
  actor.location = placeId;
  actor.lastSeenAt = Date.now();
  saveState(dataDir, world);
  return { place: placeId, name: world.places[placeId].name };
}

/** 这个地点有谁：真人 / 非真人 */
export function whoIsHere(world, placeId, exceptMemberKey = null) {
  const humans = [];
  const npcs = [];
  for (const [id, a] of Object.entries(world.actors || {})) {
    if (!a || a.location !== placeId) continue;
    if (id === exceptMemberKey) continue;
    const item = { id, name: a.name, role: a.role, kind: a.kind === 'human' ? 'human' : 'npc' };
    if (item.kind === 'human') humans.push(item);
    else npcs.push(item);
  }
  return { humans, npcs };
}

/**
 * 同场判定：**只要还有其他真人站在同一处，这场对话就是公开的**。
 * 独处 = 私密；有人 = 公开，暗号与亲密一律不得外露。
 */
export function sceneAudience(world, placeId, selfKey) {
  const { humans, npcs } = whoIsHere(world, placeId, selfKey);
  return {
    placeId,
    placeName: world.places?.[placeId]?.name || placeId,
    otherHumans: humans,
    npcs,
    isPublic: humans.length > 0,
  };
}

/** 场景消息流（供"撞见"时看见刚才发生的事）*/
export function appendSceneMessage(dataDir, placeId, message) {
  try {
    fs.mkdirSync(sceneDir(dataDir), { recursive: true });
    const file = sceneFile(dataDir, placeId);
    let doc = { messages: [] };
    try {
      if (fs.existsSync(file)) doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      doc = { messages: [] };
    }
    doc.messages = Array.isArray(doc.messages) ? doc.messages : [];
    doc.messages.push(message);
    if (doc.messages.length > 200) doc.messages = doc.messages.slice(-200);
    doc.updatedAt = Date.now();
    fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
  } catch {
    /* 场景流写失败不影响对话 */
  }
}

export function readSceneMessages(dataDir, placeId, limit = 20) {
  try {
    const file = sceneFile(dataDir, placeId);
    if (!fs.existsSync(file)) return [];
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (doc.messages || []).slice(-limit);
  } catch {
    return [];
  }
}

/** 给摘要用的一行：当前场合是公开还是独处 */
export function describeScene(world, placeId, selfKey) {
  const aud = sceneAudience(world, placeId, selfKey);
  const parts = [];
  if (aud.otherHumans.length > 0) {
    parts.push(`同场还有真人：${aud.otherHumans.map((h) => `${h.name}（${h.role}）`).join('、')}`);
  }
  if (aud.npcs.length > 0) {
    parts.push(`在场仆从与旁人：${aud.npcs.map((n) => n.name).join('、')}`);
  }
  return {
    ...aud,
    line: `${world.places?.[placeId]?.name || placeId}·${shichenOf(world.clock?.hour ?? 0)} · ${aud.isPublic ? '公开场合（有旁人在场）' : '无其他真人在场（私密）'}${parts.length ? ` · ${parts.join(' · ')}` : ''}`,
  };
}
