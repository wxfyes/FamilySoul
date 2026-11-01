/**
 * 天道回执（World Tags）—— 让「一句话改变命运」真正落账
 *
 * 铁律：**谁发生了什么事，由天道（大模型）自己申报**，引擎只负责记账。
 * 这里不做任何意图识别、不猜、不预设台词，只解析模型主动写出的回执标签：
 *
 *   [[world:relation who=waner field=trust delta=+3]]
 *   [[world:asset delta=-12.5 reason="买茶苗"]]
 *   [[world:promise due=132 text="三日内把酒楼开起来"]]
 *   [[world:spawn name="柳儿" role="邻家浣衣女" goals="赎身;照顾幼弟" secret="被钱通海的人盯着"]]
 *   [[world:move who=qiantonghai to=dock]]
 *   [[world:event text="阿吉报说码头来了新茶商"]]
 */
import { loadState, saveState, appendEvents, nextEvent, round2 } from './state.js';
import { queueProactive } from './clock.js';

const TAG_RE = /\[\[\s*world\s*:\s*([a-zA-Z_]+)([^\]]*?)\]\]/gi;
// 值可以是 "带引号的文本" 或 裸值（waner / +4 / 132）
const ARG_RE = /([a-zA-Z_]+)\s*=\s*(?:"([^"]*)"|([^\s\]]+))/g;

/** 从回复里剥出回执，返回干净正文 + 操作列表 */
export function parseWorldTags(text) {
  const ops = [];
  const clean = String(text || '').replace(TAG_RE, (_m, kind, body) => {
    ops.push({ kind: String(kind).toLowerCase(), args: parseArgs(body) });
    return '';
  });
  return { clean: clean.replace(/\n{3,}/g, '\n\n').trim(), ops };
}

function parseArgs(body) {
  const out = {};
  let m;
  ARG_RE.lastIndex = 0;
  while ((m = ARG_RE.exec(body)) !== null) {
    const key = m[1].toLowerCase();
    const value = m[2] !== undefined ? m[2] : m[3];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function buildIndex(world) {
  const map = new Map();
  for (const [id, a] of Object.entries(world.actors || {})) {
    map.set(id.toLowerCase(), id);
    if (a?.name) map.set(String(a.name), id);
  }
  return map;
}

function resolveActor(world, who) {
  if (!who) return null;
  const idx = buildIndex(world);
  const key = String(who).trim();
  if (idx.has(key.toLowerCase())) return idx.get(key.toLowerCase());
  if (idx.has(key)) return idx.get(key);
  for (const [name, id] of idx) {
    if (name.includes(key) || key.includes(name)) return id;
  }
  return null;
}

function resolvePlace(world, to) {
  if (!to) return null;
  const key = String(to).trim();
  if (world.places?.[key]) return key;
  for (const [id, p] of Object.entries(world.places || {})) {
    if (p?.name && (p.name.includes(key) || key.includes(p.name))) return id;
  }
  return null;
}

/** 记录一次回执（用于自检回执率，主人不用看 JSON 也能知道有没有在动）*/
export function recordReceipt(dataDir, hadOps, usage = null) {
  try {
    const world = loadState(dataDir);
    world.flags.receiptRounds = (Number(world.flags.receiptRounds) || 0) + 1;
    world.flags.lastUserMessageAt = Date.now();
    if (hadOps) world.flags.receiptHits = (Number(world.flags.receiptHits) || 0) + 1;

    // 成本计量：命中缓存的部分只按约十分之一计费，所以要看命中率而不是只看字数
    if (usage && typeof usage === 'object') {
      const acc = world.flags.aiUsage || { rounds: 0, prompt: 0, hit: 0, miss: 0, completion: 0 };
      acc.rounds += 1;
      acc.prompt += Number(usage.prompt_tokens) || 0;
      acc.hit += Number(usage.prompt_cache_hit_tokens) || 0;
      acc.miss += Number(usage.prompt_cache_miss_tokens) || 0;
      acc.completion += Number(usage.completion_tokens) || 0;
      world.flags.aiUsage = acc;
    }

    const arr = Array.isArray(world.flags.recentReceipts) ? world.flags.recentReceipts : [];
    arr.push(hadOps ? 1 : 0);
    world.flags.recentReceipts = arr.slice(-20);
    saveState(dataDir, world);
    return {
      rounds: world.flags.receiptRounds,
      hits: world.flags.receiptHits,
      recent: world.flags.recentReceipts,
      usage: world.flags.aiUsage || null,
    };
  } catch {
    return null;
  }
}

/**
 * 应用回执。全部失败静默跳过——绝不允许因一条畸形回执打断对话。
 * @returns {string[]} 实际生效的操作描述（用于日志）
 */
export function applyWorldTags(dataDir, ops) {
  if (!Array.isArray(ops) || ops.length === 0) return [];
  const world = loadState(dataDir);
  const events = [];
  const applied = [];

  for (const { kind, args } of ops) {
    try {
      if (kind === 'relation') {
        const id = resolveActor(world, args.who);
        const actor = id && world.actors[id];
        const rel = actor?.relations?.husband;
        const delta = Number(args.delta);
        if (!rel || !args.field || !Number.isFinite(delta)) continue;
        if (typeof rel[args.field] !== 'number') continue;
        rel[args.field] = Math.max(0, Math.min(100, rel[args.field] + delta));
        applied.push(`关系:${actor.name}.${args.field}${delta >= 0 ? '+' : ''}${delta}`);
      } else if (kind === 'asset') {
        const delta = Number(args.delta);
        if (!Number.isFinite(delta)) continue;
        world.assets.silver = round2((world.assets.silver || 0) + delta);
        applied.push(`银两${delta >= 0 ? '+' : ''}${delta}`);
      } else if (kind === 'promise') {
        const text = String(args.text || '').trim();
        if (!text) continue;
        const due = Number(args.due) || world.clock.day + 3;
        world.promises.push({ text: text.slice(0, 120), due, done: false, at: world.clock.day });
        applied.push(`承诺:${text.slice(0, 16)}（第${due}日）`);
      } else if (kind === 'spawn') {
        const name = String(args.name || '').trim();
        if (!name) continue;
        const dup = buildIndex(world).has(name);
        if (dup) continue;
        world.flags.npcSeq = (Number(world.flags.npcSeq) || 0) + 1;
        const id = `npc_${world.flags.npcSeq}`;
        world.actors[id] = {
          id,
          name,
          role: String(args.role || '城中人'),
          location: resolvePlace(world, args.place) || 'street',
          goals: String(args.goals || '').split(';').map((s) => s.trim()).filter(Boolean),
          secret: String(args.secret || '').trim() || undefined,
          relations: { husband: { trust: 50, desire: 30, fear: 0, grievance: 0 } },
          intimacy: { level: 1, tone: 0, lastAt: 0, ritual: 'solemn' },
          schedule: [],
        };
        events.push(
          nextEvent(world, { action: 'spawn', place: world.actors[id].location, payload: { id, name, role: world.actors[id].role }, isPublic: true }),
        );
        applied.push(`新人物:${name}`);
      } else if (kind === 'move') {
        const id = resolveActor(world, args.who);
        const place = resolvePlace(world, args.to);
        if (!id || !place) continue;
        world.actors[id].location = place;
        applied.push(`移动:${world.actors[id].name}→${world.places[place]?.name || place}`);
      } else if (kind === 'arrive') {
        // 被派去请的人到场：由天道点名，引擎只负责按时送达
        const id = resolveActor(world, args.who);
        if (!id) continue;
        const actor = world.actors[id];
        const minutes = Math.max(0, Math.min(120, Number(args.in) || 2));
        queueProactive(world, {
          text: args.text ? String(args.text) : null,
          reason: 'arrival',
          facts: { who: actor.name },
          speaker: actor.name,
          fallback: `相公，${actor.name}来了，正在帘外候着呢。`,
          atMs: Date.now() + minutes * 60 * 1000,
          force: true,
        });
        applied.push(`到场:${actor.name}（${minutes}分钟后）`);
      } else if (kind === 'event') {
        const text = String(args.text || '').trim();
        if (!text) continue;
        events.push(nextEvent(world, { action: 'world_note', payload: { text: text.slice(0, 120) }, isPublic: true }));
        applied.push(`事件:${text.slice(0, 16)}`);
      }
    } catch {
      /* 单条回执失败不影响其它 */
    }
  }

  if (applied.length > 0) {
    saveState(dataDir, world);
    appendEvents(dataDir, events);
  }
  return applied;
}
