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

function clampNum(n, min, max) { return Math.max(min, Math.min(max, Number(n) || 0)); }

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

/** 记账员在后台补登成功时，把本轮的回执标记翻成「有变化」*/
export function markReceiptHit(dataDir) {
  try {
    const world = loadState(dataDir);
    world.flags.receiptHits = (Number(world.flags.receiptHits) || 0) + 1;
    const arr = Array.isArray(world.flags.recentReceipts) ? world.flags.recentReceipts : [];
    if (arr.length > 0) arr[arr.length - 1] = 1;
    world.flags.recentReceipts = arr;
    saveState(dataDir, world);
  } catch {
    /* 忽略 */
  }
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
  // 闸门：府里已有的人，不可能再被迎娶/纳聘 —— 这类承诺一律不记
  const houseNames = Object.values(world.actors || {})
    .filter((a) => a?.household && a.name)
    .flatMap((a) => [a.name, a.name.length > 2 ? a.name.slice(-2) : a.name]);
  const isMarriageTalk = (s) => /(迎娶|迎纳|纳妾|聘礼|八抬|入府|进门|开脸|娶)/.test(String(s || ''));

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
        if (isMarriageTalk(text) && houseNames.some((n) => text.includes(n))) {
          applied.push(`已忽略:${text.slice(0, 12)}（府中人不可能再迎娶）`);
          continue;
        }
        const rawDue = Number(args.due);
        const due = rawDue >= world.clock.day && rawDue <= world.clock.day + 30 ? rawDue : world.clock.day + 3;
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
          origin: 'spawned', // 标记：天道自己长出来的人
          gender: String(args.gender || 'female'),
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
        if (!id) continue;
        let place = resolvePlace(world, args.to);
        if (!place && args.to) {
          // 天道叙事里出现了账本没有的去处 → 就地建一个，
          // 避免「故事在酒肆、账本还写着茶坊」的错位
          world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
          place = `place_${world.flags.placeSeq}`;
          world.places[place] = { name: String(args.to).slice(0, 20), exits: [], dynamic: true };
        }
        if (!place) continue;
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
      } else if (kind === 'appointment') {
        // 约定：约好某日某时见面 → 到点由时钟自动触发她上门
        const id = resolveActor(world, args.who);
        const actor = id ? world.actors[id] : null;
        const rawDay = Number(args.day);
        const day = rawDay >= world.clock.day && rawDay <= world.clock.day + 30 ? rawDay : world.clock.day + 1;
        const hour = Number(args.hour) || 12;
        world.appointments = Array.isArray(world.appointments) ? world.appointments : [];
        world.appointments.push({
          actorId: id || null,
          name: actor?.name || String(args.who || '').slice(0, 12),
          day,
          hour,
          every: Number(args.every) > 0 ? Number(args.every) : undefined, // 每 N 天重复
          place: resolvePlace(world, args.place) || world.actors?.husband?.location || null, // 约在哪见
          text: String(args.text || '').slice(0, 80),
          madeAt: { day: world.clock.day, hour: world.clock.hour },
        });
        applied.push(`约定:${actor?.name || args.who} 第${day}日${hour}时`);
      } else if (kind === 'faction') {
        // 势力关系：跟官府、漕帮、朝堂的态度变化
        const wantId = String(args.id || '').trim();
        const wantName = String(args.name || '').trim();
        const key = Object.keys(world.factions || {}).find((k) => {
          if (wantId && k === wantId) return true;
          if (!wantName) return false;
          const n = world.factions[k]?.name || '';
          return n.includes(wantName) || wantName.includes(n);
        });
        const f = key ? world.factions[key] : null;
        const delta = Number(args.delta);
        if (!f || !Number.isFinite(delta)) continue;
        f.relation = clampNum((Number(f.relation) || 0) + delta, -100, 100);
        applied.push(`势力:${f.name} 关系${f.relation}`);
      } else if (kind === 'clue') {
        // 线索：翻案复仇一条条攒
        const text = String(args.text || '').trim();
        if (!text) continue;
        world.clues = Array.isArray(world.clues) ? world.clues : [];
        if (world.clues.some((c) => c && String(c.text || '').slice(0, 10) === text.slice(0, 10))) continue;
        world.clues.push({ text: text.slice(0, 80), day: world.clock.day, source: String(args.source || '').slice(0, 20) });
        if (world.clues.length > 60) world.clues = world.clues.slice(-60);
        applied.push(`线索:${text.slice(0, 14)}`);
      } else if (kind === 'pregnant') {
        // 有孕：由天道判定，落进账本后就按月推进，不会聊完就没
        const id = resolveActor(world, args.who);
        const who = id ? world.actors[id] : null;
        if (!who || who.id === 'husband') continue;
        if (who.pregnancy) continue;
        who.pregnancy = { sinceDay: world.clock.day, father: String(args.father || 'husband').slice(0, 12), confirmed: true };
        applied.push(`有孕:${who.name}`);
        events.push(
          nextEvent(world, {
            action: 'pregnant',
            actor: who.id,
            place: who.location,
            payload: { text: `${who.name}有了身孕` },
            isPublic: false,
          }),
        );
      } else if (kind === 'remember') {
        // 长期记忆：一句话，永久保存，不受 14 条对话窗口限制
        const text = String(args.text || '').trim();
        if (!text) continue;
        world.memories = Array.isArray(world.memories) ? world.memories : [];
        const dup = world.memories.some((m) => m && m.text && m.text.slice(0, 12) === text.slice(0, 12));
        if (dup) continue;
        world.memories.push({ text: text.slice(0, 100), day: world.clock.day, at: Date.now() });
        if (world.memories.length > 120) world.memories = world.memories.slice(-120);
        applied.push(`记忆:${text.slice(0, 14)}`);
      } else if (kind === 'power') {
        // 新势力：立旗号、拉队伍
        const name = String(args.name || '').trim().slice(0, 20);
        if (!name) continue;
        world.powers = world.powers || {};
        const id = String(args.id || `p_${Object.keys(world.powers).length + 1}`).slice(0, 16);
        if (!world.powers[id]) {
          world.powers[id] = {
            name,
            kind: String(args.kind || '义军').slice(0, 8),
            power: Math.max(0, Number(args.power) || 5),
            relation: Number(args.relation) || 0,
            troops: Math.max(0, Number(args.troops) || 0),
            note: String(args.note || '').slice(0, 40),
          };
          applied.push(`新势力:${name}（${world.powers[id].kind}）`);
        } else {
          const p = world.powers[id];
          if (Number.isFinite(Number(args.troops))) p.troops = Math.max(0, Number(args.troops));
          if (Number.isFinite(Number(args.power))) p.power = Math.max(0, Number(args.power));
          if (Number.isFinite(Number(args.relation))) p.relation = Math.max(-100, Math.min(100, Number(args.relation)));
          applied.push(`势力:${p.name} 兵${p.troops}`);
        }
      } else if (kind === 'city') {
        // 城池归属/守备
        const cityName = String(args.name || '').trim();
        if (!cityName) continue;
        world.cities = world.cities || {};
        if (!world.cities[cityName]) {
          world.cities[cityName] = { region: String(args.region || ''), owner: 'court', defense: 20, wealth: 40, unrest: 10 };
        }
        const ct = world.cities[cityName];
        if (args.owner && world.powers?.[args.owner]) ct.owner = String(args.owner);
        if (Number.isFinite(Number(args.defense))) ct.defense = Math.max(0, Number(args.defense));
        if (Number.isFinite(Number(args.unrest))) ct.unrest = Math.max(0, Math.min(100, Number(args.unrest)));
        applied.push(`城池:${cityName} 属${world.powers?.[ct.owner]?.name || ct.owner}`);
      } else if (kind === 'troops') {
        // 招兵：护院/乡勇/兵马
        const field = String(args.field || 'guards');
        if (!['guards', 'militia', 'army'].includes(field)) continue;
        const delta = Number(args.delta);
        if (!Number.isFinite(delta) || delta === 0) continue;
        world.military = world.military || {};
        world.military[field] = Math.max(0, (Number(world.military[field]) || 0) + delta);
        applied.push(`${field}${delta >= 0 ? '+' : ''}${delta}→${world.military[field]}`);
      } else if (kind === 'infra') {
        // 基建：修路、建仓、办学…
        const key = String(args.name || '').trim();
        const keys = ['roads', 'granary', 'dock', 'workshop', 'school', 'clinic'];
        if (!keys.includes(key)) continue;
        const delta = Number(args.delta) || 1;
        world.infra = world.infra || {};
        world.infra[key] = Math.max(0, Math.min(10, (Number(world.infra[key]) || 0) + delta));
        applied.push(`基建:${key}=${world.infra[key]}`);
      } else if (kind === 'property') {
        // 新开产业：天道可以真的给世界添一间铺子
        const name = String(args.name || '').trim().slice(0, 20);
        if (!name) continue;
        world.assets.properties = Array.isArray(world.assets.properties) ? world.assets.properties : [];
        if (world.assets.properties.some((x) => x.name === name)) continue;
        world.flags.propSeq = (Number(world.flags.propSeq) || 0) + 1;
        // 位置：能对上就用已有地点，对不上就新建一个
        let placeId = null;
        const wantPlace = String(args.place || '').trim();
        if (wantPlace) {
          placeId = Object.keys(world.places || {}).find((id) => {
            const n = String(world.places[id]?.name || '');
            return n === wantPlace || n.includes(wantPlace) || wantPlace.includes(n);
          }) || null;
          if (!placeId) {
            world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
            placeId = `place_${world.flags.placeSeq}`;
            world.places[placeId] = { name: wantPlace, exits: ['street'], dynamic: true };
          }
        }
        // 掌柜 / 人手
        const keeperName = String(args.keeper || '').trim();
        const keeper = keeperName
          ? Object.values(world.actors || {}).find((a) => a?.name && (a.name === keeperName || a.name.includes(keeperName)))
          : null;
        const staff = Math.max(0, Number(args.staff) || 0);
        // 城市：话里点的城，落到疆域里；对不上就当"临江府"
        const wantCity = String(args.city || '').trim();
        const cities = (world.geo?.regions || []).flatMap((r) => r.cities || []);
        const city = wantCity && cities.some((c) => c.includes(wantCity) || wantCity.includes(c))
          ? cities.find((c) => c.includes(wantCity) || wantCity.includes(c))
          : (wantCity || '临江府');
        world.assets.properties.push({
          id: `prop_${world.flags.propSeq}`,
          name,
          kind: String(args.kind || 'shops').slice(0, 12),
          incomePerDay: Math.max(0, Number(args.set ?? args.income ?? 0) || 0),
          status: String(args.status || '筹备开张').slice(0, 12),
          place: placeId,
          keeper: keeper?.id || null,
          staff,
          city,
          note: String(args.note || '').slice(0, 60),
          openedDay: world.clock.day,
        });
        applied.push(`新产业:${name} 日入${Number(args.set ?? args.income ?? 0) || 0}两`);
      } else if (kind === 'income') {
        // 产业营收：天道可以直接改（酒楼开张、扩店面、涨价），不再受 3 两封顶限制
        const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
        const p = props.find((x) => x.id === args.id) || props.find((x) => args.name && String(x.name || '').includes(args.name));
        if (!p) continue;
        const setV = Number(args.set);
        const deltaV = Number(args.delta);
        if (Number.isFinite(setV)) p.incomePerDay = Math.max(0, setV);
        else if (Number.isFinite(deltaV)) p.incomePerDay = Math.max(0, (Number(p.incomePerDay) || 0) + deltaV);
        if (args.status) p.status = String(args.status).slice(0, 20);
        p.incomePerDay = Math.round((Number(p.incomePerDay) || 0) * 100) / 100;
        applied.push(`产业:${p.name} 日入${p.incomePerDay}两${args.status ? `（${p.status}）` : ''}`);
        // 一开张，那条「择吉日开张」的承诺就算办成了
        if (args.status && /开张|营业|开业/.test(String(args.status))) {
          for (const pr of world.promises || []) {
            if (!pr.done && /开张|开业/.test(String(pr.text || ''))) {
              pr.done = true;
              pr.doneDay = world.clock.day;
              applied.push(`承诺完成:${String(pr.text).slice(0, 12)}`);
            }
          }
        }
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
