/**
 * 来信 / 回话 / 求见：与主场景聊天分开的独立通道。
 *
 * 铁律：
 *   1. 不在场的人递话，只能进这里，绝不直接塞进主聊天；
 *   2. 私密处求见默认「门外候着」，必须相公点了「见」才 moveActor 进来；
 *   3. 每条都落盘，回信/回话不污染当前场景；第三人以上不自动打断；
 *   4. 回信必须相公本人点，AI 不代回。
 */

const THREAD_CAP = 240;
const MSG_CAP = 80;

export function ensureCorrespondence(world) {
  world.correspondence = Array.isArray(world.correspondence) ? world.correspondence : [];
  world.flags = world.flags || {};
  return world.correspondence;
}

function nextId(world, prefix) {
  world.flags = world.flags || {};
  const key = `${prefix}Seq`;
  world.flags[key] = (Number(world.flags[key]) || 0) + 1;
  return `${prefix}_${world.flags[key]}`;
}

export function openCorrespondence(world, {
  fromId = '', fromName = '', to = 'husband', kind = 'letter', privacy = 'private',
  placeId = '', placeName = '', source = '', text = '', requiresConsent = false, key = '',
} = {}) {
  ensureCorrespondence(world);
  const t = String(text || '').trim();
  if (!t) return null;
  // 同一件事不要重复开 thread（长轮询/重试）
  if (key) {
    const old = world.correspondence.find((x) => x && x.key === key && x.status !== 'declined');
    if (old) return old;
  }
  const now = Date.now();
  const thread = {
    id: nextId(world, 'corr'),
    key: String(key || ''),
    fromId: String(fromId || ''),
    fromName: String(fromName || '').slice(0, 20),
    to: String(to || 'husband'),
    kind: ['letter', 'report', 'visit'].includes(kind) ? kind : 'letter',
    privacy: privacy === 'private' ? 'private' : 'public',
    placeId: String(placeId || ''),
    placeName: String(placeName || '').slice(0, 30),
    source: String(source || '').slice(0, 30),
    status: 'pending',
    unread: true,
    requiresConsent: Boolean(requiresConsent),
    createdAt: now,
    day: world.clock?.day || 1,
    hour: world.clock?.hour || 0,
    messages: [{
      id: `${now}_1`, role: 'them', text: t, at: now,
      day: world.clock?.day || 1, hour: world.clock?.hour || 0,
    }],
  };
  world.correspondence.push(thread);
  world.correspondence = world.correspondence.slice(-THREAD_CAP);
  return thread;
}

export function appendCorrespondence(world, threadId, role, text) {
  ensureCorrespondence(world);
  const thread = world.correspondence.find((x) => x && x.id === String(threadId));
  if (!thread) return null;
  const t = String(text || '').trim();
  if (!t) return null;
  thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
  thread.messages.push({
    id: `${Date.now()}_${thread.messages.length + 1}`,
    role: role === 'me' ? 'me' : 'them',
    text: t,
    at: Date.now(),
    day: world.clock?.day || 1,
    hour: world.clock?.hour || 0,
  });
  thread.messages = thread.messages.slice(-MSG_CAP);
  thread.unread = role !== 'me';
  return thread;
}

export function listCorrespondence(world, to = 'husband') {
  ensureCorrespondence(world);
  return world.correspondence
    .filter((x) => x && x.to === String(to))
    .slice(-80)
    .reverse()
    .map((x) => ({
      id: x.id, fromId: x.fromId, fromName: x.fromName, kind: x.kind,
      privacy: x.privacy, source: x.source, status: x.status, unread: Boolean(x.unread),
      requiresConsent: Boolean(x.requiresConsent), placeName: x.placeName,
      day: x.day, hour: x.hour,
      last: (x.messages || []).slice(-1)[0] || null,
    }));
}

export function getCorrespondence(world, id, to = 'husband') {
  ensureCorrespondence(world);
  const thread = world.correspondence.find((x) => x && x.id === String(id) && x.to === String(to));
  return thread || null;
}

export function markCorrespondence(world, id, to = 'husband') {
  const thread = getCorrespondence(world, id, to);
  if (!thread) return null;
  thread.unread = false;
  if (thread.status === 'pending') thread.status = 'read';
  return thread;
}

export function setCorrespondenceStatus(world, id, to, status) {
  const thread = getCorrespondence(world, id, to);
  if (!thread) return null;
  thread.status = String(status || thread.status);
  thread.unread = false;
  return thread;
}
