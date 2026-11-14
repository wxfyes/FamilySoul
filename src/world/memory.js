// 长期记忆（world.memories）的唯一写入口与唯一召回口
//
// 规则（按类别，不按姓名）：
// 1. 写入：about 一律存人物 id；LLM 给的人名/称谓会被解析成 id，正文里提到的人也会自动补进 about。
// 2. 类别：kind='notice' 是城里的公告（如新面孔入城），只在当事人在场时才被想起；其余都是"人与人之间的旧事"。
// 3. 留存：公告最多留 NOTICE_CAP 条；旧事上限 MEMORY_CAP 条。超限时先丢公告，再丢最旧的普通闲事；
//    私情、婚嫁、生死、承诺、大案这些"核心旧事"单独保护，绝不被闲事挤掉。
// 4. 召回：只召回与"在场的人"相关的旧事（about 命中或正文点名），若当前发言提及特定过往关键词则优先召回，绝不遗忘。

export const MEMORY_CAP = 2000;
export const CORE_MEMORY_CAP = 1500;
export const NOTICE_CAP = 20;

// 丈夫（真人主角）在世界里的通用称谓
const HUSBAND_ALIASES = ['相公', '王甯', '王掌柜'];

// 角色常见历史别名映射（处理改名或小名）
const LEGACY_ID_ALIASES = {
  ziyan: 'liuwenxia',
  紫嫣: 'liuwenxia',
  刘文霞: 'liuwenxia',
  文霞: 'liuwenxia',
  waner: 'waner',
  婉儿: 'waner',
  沈婉儿: 'waner',
  yunniang: 'yunniang',
  芸娘: 'yunniang',
  林芸娘: 'yunniang',
  xiaocui: 'xiaocui',
  小翠: 'xiaocui',
};

function aliasesOf(world, id) {
  const a = world.actors?.[id];
  const out = [];
  if (a?.name) {
    out.push(String(a.name));
    if (a.name.length > 2) out.push(String(a.name).slice(-2));
  }
  if (id === 'husband') out.push(...HUSBAND_ALIASES);
  if (id === 'liuwenxia') out.push('紫嫣', '刘文霞', '文霞', '于家酒肆');
  return [...new Set(out.filter((n) => n && n.length >= 2))];
}

function resolveId(world, token) {
  const t = String(token || '').trim();
  if (!t) return null;
  if (LEGACY_ID_ALIASES[t] && world.actors?.[LEGACY_ID_ALIASES[t]]) {
    return LEGACY_ID_ALIASES[t];
  }
  if (world.actors?.[t]) return t;
  if (HUSBAND_ALIASES.includes(t)) return 'husband';
  for (const [id, a] of Object.entries(world.actors || {})) {
    if (a && a.name === t) return id;
  }
  for (const [id, a] of Object.entries(world.actors || {})) {
    if (a && a.name && t.length >= 2 && (a.name.endsWith(t) || t.endsWith(a.name))) return id;
  }
  return null;
}

/** 正文里点到名的人（含丈夫称谓）→ id 列表 */
export function mentionedIds(world, text) {
  const t = String(text || '');
  const ids = [];
  for (const id of Object.keys(world.actors || {})) {
    if (aliasesOf(world, id).some((n) => t.includes(n))) ids.push(id);
  }
  return ids;
}

/** 把一条记忆的 about 规范成 id 数组（名字→id，并补上正文点到的人） */
export function normalizeAbout(world, m) {
  const raw = Array.isArray(m?.about) ? m.about : String(m?.about || '').split(/[,，、]/);
  const ids = new Set();
  for (const tok of raw) {
    const id = resolveId(world, tok);
    if (id) ids.add(id);
  }
  for (const id of mentionedIds(world, m?.text)) ids.add(id);
  return [...ids];
}

function isNotice(m) {
  return m?.kind === 'notice' || /^新面孔入城/.test(String(m?.text || ''));
}

const CORE_MEMORY_RE = /(契纸|赎|还清|立约|托付终身|身孕|骨肉|私情|上房|留宿|侍寝|肌肤|定情|认下.*(关系|私情)|应了.*(相公|王甯)|夫妻之实|同床|云雨|圆房|收了房|和离|休书|婚嫁|嫁了|娶了|送官|衙门|收监|判(?:案|罪|了)|结案|亡故|病故|去世|死了|圣旨|诏书|尚方宝剑|提督|开府|金銮殿|廷辩|早朝|罢免|革职|实授|拜官|攻城|破城|誓师|大捷|承诺|誓言|立誓|答应|平妻|正房|王府|提督府)/;

/** 核心旧事：不许被普通闲事挤掉 */
export function isCoreMemory(m) {
  return Boolean(m && (m.permanent || CORE_MEMORY_RE.test(String(m.text || ''))));
}

/** 留存规则：公告单独限额；总量超限时先丢公告，再丢最旧的普通闲事，核心旧事优先保 */
export function trimMemories(world) {
  const list = Array.isArray(world.memories) ? world.memories.filter((m) => m && String(m.text || '').trim()) : [];
  const notices = list.filter(isNotice);
  const dropNotice = new Set(notices.slice(0, Math.max(0, notices.length - NOTICE_CAP)));
  let kept = list.filter((m) => !dropNotice.has(m));
  if (kept.length > MEMORY_CAP) {
    const core = kept.filter(isCoreMemory);
    const normal = kept.filter((m) => !isCoreMemory(m));
    const coreKeep = core.slice(-Math.min(core.length, CORE_MEMORY_CAP));
    const room = Math.max(0, MEMORY_CAP - coreKeep.length);
    const normalKeep = normal.slice(-room);
    const keepSet = new Set([...coreKeep, ...normalKeep]);
    kept = kept.filter((m) => keepSet.has(m));
  }
  const removed = list.length - kept.length;
  world.memories = kept;
  return removed;
}

/**
 * 唯一写入口
 * @returns {object|null} 写入的记忆；重复或空文本返回 null
 */
export function addMemory(world, { text, about = [], visible = 'private', kind = 'event', day, at, id, permanent = false } = {}) {
  const t = String(text || '').trim().slice(0, 160);
  if (!t) return null;
  world.memories = Array.isArray(world.memories) ? world.memories : [];
  const key20 = t.slice(0, 20);
  if (world.memories.some((m) => {
    if (!m?.text) return false;
    const mt = String(m.text).trim();
    return mt === t || (key20.length >= 12 && mt.startsWith(key20));
  })) {
    return null;
  }
  const resolvedKind = /^新面孔入城/.test(t) ? 'notice' : String(kind || 'event');
  const isPerma = Boolean(permanent || /(圣旨|诏书|尚方宝剑|誓言|立誓|提督王府|婚书)/.test(t));
  const rec = {
    ...(id ? { id } : {}),
    text: t,
    day: Number(day) || Number(world.clock?.day) || 1,
    at: Number(at) || Date.now(),
    about: normalizeAbout(world, { text: t, about }),
    visible: String(visible || 'private'),
    kind: resolvedKind,
    permanent: isPerma,
  };
  world.memories.push(rec);
  trimMemories(world);
  return rec;
}

/** 老数据迁移：补齐 about 为 id、给公告打上 kind（幂等） */
export function migrateMemories(world) {
  let changed = 0;
  for (const m of world.memories || []) {
    if (!m) continue;
    const about = normalizeAbout(world, m);
    if (JSON.stringify(about) !== JSON.stringify(m.about || [])) {
      m.about = about;
      changed += 1;
    }
    const expectedKind = /^新面孔入城/.test(String(m.text || '')) ? 'notice' : (m.kind || 'event');
    if (m.kind !== expectedKind) {
      m.kind = expectedKind;
      changed += 1;
    }
  }
  changed += trimMemories(world);
  return changed;
}

/**
 * 唯一召回口：与 ids 里任何一人相关的旧事
 * 相关 = about 命中 或 正文点到其名（兼容尚未迁移的老数据）
 * 公告只有当事人在 ids 里才算相关。
 * 若提供了 query（玩家当前说的话），额外将匹配关键词的旧事优先保留。
 */
export function recallMemories(world, ids = [], { limit = 16, query = '' } = {}) {
  const rawIds = (ids || []).filter(Boolean);
  const q = String(query || '');
  const qMentioned = q ? mentionedIds(world, q) : [];
  const want = new Set();
  for (const rawId of [...rawIds, ...qMentioned]) {
    want.add(rawId);
    const resolved = resolveId(world, rawId);
    if (resolved) want.add(resolved);
  }
  if (!want.size) return [];

  const names = [];
  for (const id of want) names.push(...aliasesOf(world, id));

  const hits = (world.memories || []).filter((m) => {
    if (!m || !m.text) return false;
    const about = Array.isArray(m.about) ? m.about : [];
    const mappedAbout = about.map((x) => LEGACY_ID_ALIASES[x] || x);
    if (mappedAbout.some((x) => want.has(x))) {
      // 如果只是泛泛的 husband 相关，但当前有具体在场/提及 NPC，优先看跟具体 NPC 有关的
      if (want.size > 1 && want.has('husband')) {
        const nonHusIds = [...want].filter((id) => id !== 'husband');
        const nonHusNames = [];
        for (const nid of nonHusIds) nonHusNames.push(...aliasesOf(world, nid));
        if (mappedAbout.some((x) => nonHusIds.includes(x)) || nonHusNames.some((n) => String(m.text).includes(n))) {
          return true;
        }
        return false;
      }
      return true;
    }
    if (isNotice(m)) return false;
    const t = String(m.text);
    if (want.size > 1 && want.has('husband')) {
      const nonHusIds = [...want].filter((id) => id !== 'husband');
      const nonHusNames = [];
      for (const nid of nonHusIds) nonHusNames.push(...aliasesOf(world, nid));
      return nonHusNames.some((n) => t.includes(n));
    }
    return names.some((n) => t.includes(n));
  });

  if (hits.length <= limit) {
    return hits.map((m) => String(m.text));
  }

  // 如果超出 limit，确保重要里程碑（如赎契、身孕、立约、2026、老公、婚配、共管底档）与玩家当前提及的内容优先保留
  const qTokens = (q.match(/[\u4e00-\u9fa5]{2,4}|\d+/g) || []).filter((w) => !/^(我们|你们|他们|这个|那个|什么|怎么|觉得|现在|今天|昨天|前天|记得|知道)$/.test(w));

  const pinned = [];
  const rest = [];
  for (const m of hits) {
    const t = String(m.text);
    const about = Array.isArray(m.about) ? m.about : [];
    const isTargetMention = qMentioned.length > 0 && (
      qMentioned.some((id) => about.includes(id) || aliasesOf(world, id).some((n) => t.includes(n)))
    );
    const isCore = isTargetMention ||
      /(契纸|赎|还清|归到.*名下|身孕|骨肉|2026|老公|托付终身|立约|私情|上房|留宿|侍寝|肌肤|定情|认下.*(关系|私情)|应了.*(相公|王甯)|同床|云雨|圆房|收了房|夫妻之实|姐妹|侧室|和离|过门|底档|核账|大门|相称|摊明|相好|答应|妆匣)/.test(t) ||
      (qTokens.length > 0 && qTokens.some((tk) => t.includes(tk)));
    if (isCore) pinned.push(t);
    else rest.push(t);
  }

  // 命中的关键旧事优先保留（最多占满 limit-2，给最新闲事留 2 条空间；若闲事不足则关键事全占）
  const keepRestCount = rest.length > 0 ? Math.min(rest.length, Math.max(0, Math.min(2, limit - pinned.length || 2))) : 0;
  const maxPinned = Math.min(pinned.length, limit - keepRestCount);
  const selectedPinned = maxPinned > 0 ? pinned.slice(-maxPinned) : [];
  const selectedRest = keepRestCount > 0 ? rest.slice(-keepRestCount) : [];
  // 保持原有时间顺序输出
  const selectedSet = new Set([...selectedPinned, ...selectedRest]);
  return hits.map((m) => String(m.text)).filter((t) => selectedSet.has(t));
}
