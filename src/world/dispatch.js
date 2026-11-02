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
import { loadState, saveState, appendEvents, nextEvent, round2, forceOf } from './state.js';
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
  const raw = String(to).trim();
  const alias = { 我房间: 'husband_room', 我的房间: 'husband_room', 正房: 'husband_room', 上房: 'husband_room', 卧房: 'husband_room', 寝室: 'husband_room', 房里: 'husband_room', 我房里: 'husband_room' };
  const key = alias[raw] && world.places?.[alias[raw]] ? alias[raw] : raw;
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
export function applyWorldTags(dataDir, ops, opts = {}) {
  if (!Array.isArray(ops) || ops.length === 0) return [];
  const world = loadState(dataDir);
  const events = [];
  // 闸门：府里已有的人，不可能再被迎娶/纳聘 —— 这类承诺一律不记
  const houseNames = Object.values(world.actors || {})
    .filter((a) => a?.household && a.name)
    .flatMap((a) => [a.name, a.name.length > 2 ? a.name.slice(-2) : a.name]);
  const isMarriageTalk = (s) => /(迎娶|迎纳|纳妾|聘礼|八抬|入府|进门|开脸|娶)/.test(String(s || ''));

  const applied = [];

  const selfId = String(opts?.selfId || 'husband');
  for (const { kind, args } of ops) {
    // 真人玩家下的军令，默认算她自己的
    if ((kind === 'troops' || kind === 'siege') && args && !args.who && !args.by) {
      args.who = selfId;
    }
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
        world.promises.push({
          text: String(args.text || '').slice(0, 80),
          due: due,
          at: world.clock.day,
          done: false,
          about: String(args.who || args.about || '').split(/[,，、]/).map((x) => x.trim()).filter(Boolean),
        });
        applied.push(`承诺:${text.slice(0, 16)}（第${due}日）`);
      } else if (kind === 'spawn') {
        let name = String(args.name || '').trim();
        if (!name) continue;
        // 名字不能像一句话（"先去请个""是新请的"这种）
        const looksLikeSentence = /(的|了|是|请|个|去|来|叫|新|这|那|把|被|给|要|得|着|过|您|你|我|他|她)/.test(name) || name.length > 4;
        if (looksLikeSentence) {
          const roleWord = String(args.role || '').trim();
          name = roleWord && roleWord.length <= 4 && !/的|了|是/.test(roleWord) ? roleWord : '城中人';
        }
        const idx = buildIndex(world);
        if (idx.has(name)) continue;
        // 同一个人别再长一遍：名字互相包含（陈郎中 / 郎中）也算重复
        const similar = Object.values(world.actors || {}).find((a) => {
          const an = String(a?.name || '');
          if (!an) return false;
          return an.includes(name) || name.includes(an);
        });
        if (similar) {
          applied.push(`已有此人:${similar.name}`);
          continue;
        }
        world.flags.npcSeq = (Number(world.flags.npcSeq) || 0) + 1;
        const id = `npc_${world.flags.npcSeq}`;
        world.actors[id] = {
          id,
          name,
          origin: 'spawned', // 标记：天道自己长出来的人
          gender: String(args.gender || 'female'),
          role: String(args.role || '城中人'),
          location: (() => {
            const asked = resolvePlace(world, args.place);
            if (asked) return asked;
            // 按行当给个自己的地方：郎中开药铺、稳婆有家、绣娘有绣坊
            const r = String(args.role || '');
            let placeName = '';
            if (/郎中|大夫|医/.test(r)) placeName = `${name}的药铺`;
            else if (/稳婆|接生/.test(r)) placeName = `${name}家`;
            else if (/媒婆|牙婆/.test(r)) placeName = `${name}家`;
            else if (/绣娘|绣/.test(r)) placeName = `${name}的绣坊`;
            else if (/仵作|衙役|更夫/.test(r)) return 'yamen';
            else if (/掌柜|东家/.test(r)) placeName = `${name}的铺子`;
            else if (/道士|尼姑/.test(r)) placeName = `${name}的道观`;
            if (!placeName) return 'street';
            world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
            const pid = `place_${world.flags.placeSeq}`;
            world.places[pid] = { name: placeName.slice(0, 20), exits: ['street'], owner: id, dynamic: true };
            return pid;
          })(),
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
      } else if (kind === 'report') {
        // 报官：只记事实（谁、告谁、告什么、有什么人证），不写细节
        const who = resolveActor(world, args.who || args.by);
        const against = resolveActor(world, args.against || args.to);
        const claim = String(args.claim || args.text || '').slice(0, 60);
        if (!who || !against || !claim) continue;
        world.cases = Array.isArray(world.cases) ? world.cases : [];
        const witnesses = Object.values(world.actors || {})
          .filter((a) => a && !a.dead && a.id !== who && a.id !== against && a.location === world.actors[who]?.location)
          .map((a) => a.name);
        world.flags = world.flags || {};
        world.flags.caseSeq = (Number(world.flags.caseSeq) || 0) + 1;
        world.cases.push({
          id: `case_${world.flags.caseSeq}`,
          day: world.clock.day, hour: world.clock.hour,
          place: world.actors[who]?.location || null,
          who: world.actors[who]?.name || who, whoId: who,
          against: world.actors[against]?.name || against, againstId: against,
          claim, witnesses, status: 'filed', verdict: null,
        });
        events.push(nextEvent(world, { actor: who, action: 'report', place: 'yamen', payload: { text: `${world.actors[who]?.name}到县衙告${world.actors[against]?.name}` }, isPublic: true }));
        applied.push(`报官:${world.actors[who]?.name}告${world.actors[against]?.name}`);
      } else if (kind === 'move') {
        const id = resolveActor(world, args.who);
        if (!id) continue;
        let place = resolvePlace(world, args.to);
        if (!place && args.to) {
          // 天道叙事里出现了账本没有的去处 → 就地建一个，
          // 避免「故事在酒肆、账本还写着茶坊」的错位
          world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
          place = `place_${world.flags.placeSeq}`;
          const fromPlace = world.actors[id]?.location;
          world.places[place] = {
            name: String(args.to).slice(0, 20),
            exits: fromPlace ? [fromPlace] : [],
            owner: id === 'husband' ? 'husband' : 'public',
            dynamic: true,
          };
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
        world.clues.push({ text: text.slice(0, 80), day: world.clock.day, source: String(args.source || '').slice(0, 20), owner: String(args.who || selfId || 'husband') });
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
        world.memories.push({
          text: String(args.text || '').slice(0, 120),
          day: world.clock.day,
          at: Date.now(),
          about: String(args.about || args.who || '').split(/[,，、]/).map((x) => x.trim()).filter(Boolean),
          visible: String(args.visible || 'private'),
        });
        if (world.memories.length > 120) world.memories = world.memories.slice(-120);
        applied.push(`记忆:${text.slice(0, 14)}`);
      } else if (kind === 'ally') {
        // 结盟：合兵打仗
        const a = resolveActor(world, args.a || args.who);
        const b = resolveActor(world, args.b || args.with);
        if (!a || !b || a === b) continue;
        world.allies = world.allies || {};
        world.allies[a] = Array.from(new Set([...(world.allies[a] || []), b]));
        world.allies[b] = Array.from(new Set([...(world.allies[b] || []), a]));
        applied.push(`结盟:${world.actors[a]?.name}↔${world.actors[b]?.name}`);
      } else if (kind === 'loan') {
        // 借钱：钱真的从一方到另一方，同时立一条还款承诺
        const fromId = String(args.from || 'husband');
        const toId = resolveActor(world, args.to || args.who);
        const amount = round2(Number(args.amount) || 0);
        if (!toId || amount <= 0) continue;
        // 借给自己 → 直接拒绝（记账员偶尔会写 to=husband）
        if (String(toId) === String(fromId)) {
          applied.push('借款无效:借方与贷方相同');
          continue;
        }
        // 同一天、同一对、同一数目只记一次，避免重复借贷
        const dup = (world.promises || []).find(
          (pr) => pr && pr.loan && !pr.done && pr.loan.from === fromId && pr.loan.to === toId
            && Math.abs(Number(pr.loan.amount) - amount) < 0.01 && Number(pr.at) === Number(world.clock.day),
        );
        if (dup) {
          applied.push('借款已记过，未重复落账');
          continue;
        }
        world.wallets = world.wallets || {};
        const payerIsHusband = fromId === 'husband';
        const payerBalance = payerIsHusband ? (Number(world.assets.silver) || 0) : (Number(world.wallets[fromId]) || 0);
        if (payerBalance < amount) {
          applied.push(`借钱失败:${world.actors[fromId]?.name || fromId}只有${payerBalance}两`);
          continue;
        }
        if (payerIsHusband) world.assets.silver = round2(payerBalance - amount);
        else world.wallets[fromId] = round2(payerBalance - amount);
        world.wallets[toId] = round2((Number(world.wallets[toId]) || 0) + amount);
        world.flags = world.flags || {};
        world.flags.loanSeq = (Number(world.flags.loanSeq) || 0) + 1;
        const dueDay = Number(args.due) > 0 ? Number(args.due) : (Number(world.clock.day) || 1) + 30;
        world.promises.push({
          text: `${world.actors[fromId]?.name || '相公'}借给${world.actors[toId]?.name || '她'}${amount}两（${world.actors[toId]?.name || '她'}欠${world.actors[fromId]?.name || '相公'}），第${dueDay}日还清`,
          due: dueDay,
          at: world.clock.day,
          done: false,
          about: [toId],
          loan: { from: fromId, to: toId, amount },
        });
        world.memories = Array.isArray(world.memories) ? world.memories : [];
        world.memories.push({ text: `${world.actors[fromId]?.name || '相公'}借给${world.actors[toId]?.name || '她'}${amount}两，${world.actors[toId]?.name || '她'}欠着`, day: world.clock.day, at: Date.now(), about: [toId], visible: 'private' });
        applied.push(`借款:${amount}两 已到账（${world.actors[toId]?.name || toId}）`);
      } else if (kind === 'repay') {
        // 还钱：钱回到出借人手里，承诺作废
        const who = resolveActor(world, args.who || args.from);
        const amount = round2(Number(args.amount) || 0);
        if (!who || amount <= 0) continue;
        world.wallets = world.wallets || {};
        const have = Number(world.wallets[who]) || 0;
        if (have < amount) {
          applied.push(`还钱失败:${world.actors[who]?.name || who}只有${have}两`);
          continue;
        }
        world.wallets[who] = round2(have - amount);
        const loan = (world.promises || []).find((pr) => !pr.done && pr.loan && pr.loan.to === who);
        const lender = loan?.loan?.from || 'husband';
        if (lender === 'husband') world.assets.silver = round2((Number(world.assets.silver) || 0) + amount);
        else world.wallets[lender] = round2((Number(world.wallets[lender]) || 0) + amount);
        if (loan) {
          loan.done = true;
          loan.doneDay = world.clock.day;
        }
        applied.push(`还款:${amount}两 已到账`);
      } else if (kind === 'forgive') {
        // 免债：钱不收回，凭证作废（这是"送她"，不是"取消"）
        const who = resolveActor(world, args.who || args.to);
        const target = (world.promises || []).find(
          (pr) => !pr.done && pr.loan && (!who || pr.loan.to === who),
        );
        if (!target) {
          applied.push('免债:没有可免的借款');
          continue;
        }
        target.done = true;
        target.doneDay = world.clock.day;
        target.forgiven = true;
        const debtor = target.loan.to;
        const creditor = target.loan.from;
        world.memories = Array.isArray(world.memories) ? world.memories : [];
        world.memories.push({
          text: `${world.actors?.[creditor]?.name || creditor}免了${world.actors?.[debtor]?.name || debtor}${target.loan.amount}两的债`,
          day: world.clock.day,
          at: Date.now(),
          about: [debtor, creditor].filter(Boolean),
          visible: 'private',
        });
        const rel = world.actors?.[debtor]?.relations?.husband;
        if (rel && typeof rel.trust === 'number') rel.trust = Math.min(100, rel.trust + 5);
        applied.push(`免债:${target.loan.amount}两 已勾销`);
      } else if (kind === 'collect') {
        // 讨债：当场从她账上扣
        const who = resolveActor(world, args.who || args.to);
        if (!who) continue;
        const loan = (world.promises || []).find((pr) => !pr.done && pr.loan && pr.loan.to === who);
        if (!loan) {
          applied.push('讨债:没有欠账');
          continue;
        }
        const owed = round2((Number(loan.loan.amount) || 0) - (Number(loan.repaid) || 0));
        const purse = Number(world.wallets?.[who]) || 0;
        const take = Math.min(purse, owed);
        if (take <= 0) {
          applied.push('讨债:她账上没钱');
          continue;
        }
        world.wallets = world.wallets || {};
        world.wallets[who] = round2(purse - take);
        const lender = loan.loan.from || 'husband';
        if (lender === 'husband') world.assets.silver = round2((Number(world.assets.silver) || 0) + take);
        else world.wallets[lender] = round2((Number(world.wallets[lender]) || 0) + take);
        loan.repaid = round2((Number(loan.repaid) || 0) + take);
        if ((Number(loan.repaid) || 0) >= (Number(loan.loan.amount) || 0)) {
          loan.done = true;
          loan.doneDay = world.clock.day;
        }
        applied.push(`讨债:收回${take}两`);
      } else if (kind === 'spend') {
        // 花钱：买东西、付账、打赏。文与两都认（1000 文 = 1 两）
        const who = String(args.who || 'husband');
        const unit = String(args.unit || '文');
        let amount = Number(args.amount);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        if (unit === '文') amount = round2(amount / 1000);
        amount = round2(amount);
        const actorId = who === 'husband' ? 'husband' : who;
        const isHus = actorId === 'husband';
        if (isHus) {
          world.assets.copper = Number(world.assets.copper) || 0;
          const silver = Number(world.assets.silver) || 0;
          const total = silver + world.assets.copper / 1000;
          if (total < amount) {
            applied.push(`钱不够:需${amount}两`);
            continue;
          }
          // 先用铜钱付，铜钱不够再动银子
          const copper = Number(world.assets.copper) || 0;
          const needWen = Math.round(amount * 1000);
          if (copper >= needWen) {
            world.assets.copper = copper - needWen;
          } else {
            const rest = round2((needWen - copper) / 1000);
            world.assets.copper = 0;
            world.assets.silver = round2(silver - rest);
          }
          applied.push(`花销:${amount}两 → 余银${world.assets.silver}两/铜${world.assets.copper}文`);
        } else {
          world.wallets = world.wallets || {};
          const have = Number(world.wallets[actorId]) || 0;
          if (have < amount) {
            applied.push(`钱不够:需${amount}两`);
            continue;
          }
          world.wallets[actorId] = round2(have - amount);
          applied.push(`花销:${amount}两 → 余${world.wallets[actorId]}两`);
        }
      } else if (kind === 'kill') {
        // 杀一个人：人没了，官位空出来，等人顶上
        const id = resolveActor(world, args.who || args.name);
        const a = id && world.actors[id];
        if (!a || a.id === 'husband') continue;
        // 动天子 → 先起一桩天道示警，不能一杀了之
        if (id === 'emperor' && !args.confirmed) {
          world.court = world.court || {};
          world.court.decisions = Array.isArray(world.court.decisions) ? world.court.decisions : [];
          const dm = world.court.mandate || {};
          world.court.decisions.push({
            id: `d_${world.clock.day}_${world.court.decisions.length}`,
            kind: 'regicide',
            target: 'emperor',
            createdDay: world.clock.day,
          });
          applied.push(
            `天道示警:天子${a.name}是${dm.quality === 'benevolent_deceived' ? '被权臣蒙蔽的仁君' : '昏君'}——${dm.note || ''}。真要动手，须再下一次决心。`,
          );
          events.push(
            nextEvent(world, {
              action: 'heaven_warning',
              actor: 'husband',
              place: '京城',
              payload: { text: '天道示警：天子被蒙蔽，杀之恐招天罚' },
              isPublic: false,
            }),
          );
          continue;
        }
        a.dead = true;
        a.deadDay = world.clock.day;
        if (a.office && world.court?.offices?.[a.office]) {
          world.court.offices[a.office].holder = null;
          world.court.offices[a.office].vacant = true;
        }
        world.reputation = Math.max(0, (Number(world.reputation) || 50) - 5);
        world.wanted = Math.min(100, (Number(world.wanted) || 0) + 15);
        applied.push(`${a.name} 已死${a.office ? '（官职空缺）' : ''}`);
        events.push(
          nextEvent(world, {
            action: 'death',
            actor: id,
            place: a.location || null,
            payload: { text: `${a.name}死了` },
            isPublic: true,
          }),
        );
      } else if (kind === 'regicide') {
        // 杀了被蒙蔽的仁君：天下大乱，天道另择天命之人
        const emp = world.actors?.emperor;
        if (!emp || emp.dead) continue;
        emp.dead = true;
        emp.deadDay = world.clock.day;
        const off = world.court?.offices?.emperor;
        if (off) {
          off.holder = null;
          off.vacant = true;
        }
        world.court.decisions = [];
        world.court.mandate = { ...(world.court.mandate || {}), wrath: true, wrathDay: world.clock.day };
        world.wanted = 100;
        world.reputation = Math.max(0, (Number(world.reputation) || 50) - 40);

        // 天下大乱：各城民心崩、守备乱
        for (const ct of Object.values(world.cities || {})) {
          if (!ct) continue;
          ct.unrest = Math.min(100, (Number(ct.unrest) || 0) + 30);
          ct.defense = Math.max(3, Math.round((Number(ct.defense) || 10) * 0.7));
        }
        // 各地义军并起
        world.powers = world.powers || {};
        for (const nm of ['山东义军', '河北义军', '关中义军']) {
          const id = `rebel_${nm}`;
          if (!world.powers[id]) {
            world.powers[id] = { name: nm, kind: '义军', power: 20, relation: -20, troops: 2000 + Math.floor(Math.random() * 3000), note: '闻天子遇弑，起兵讨逆' };
          }
        }
        // 天道另择天命之人
        const given = ['景琰', '怀瑾', '承煜', '明恪', '子期'];
        const surname = ['刘', '李', '赵', '陈', '萧'][Math.floor(Math.random() * 5)];
        const chosenName = surname + given[Math.floor(Math.random() * given.length)];
        world.flags.chosenName = chosenName;
        world.powers.chosen = { name: `${chosenName}（天命所归）`, kind: '义军', power: 40, relation: -30, troops: 3000, note: '应运而起，众望所归' };
        applied.push(`弑君:天罚降临，${chosenName} 应运而起`);
        events.push(
          nextEvent(world, {
            action: 'regicide',
            actor: 'husband',
            place: '京城',
            payload: { text: `天子遇弑，天下大乱，${chosenName} 起兵` },
            isPublic: true,
          }),
        );
      } else if (kind === 'office') {
        // 顶缺：空出来的官位，谁有本事谁坐
        const post = String(args.post || '').trim();
        let id = resolveActor(world, args.who || args.name);
        const off = world.court?.offices?.[post];
        if (!off) continue;
        if (!off.vacant) continue;
        // 想任一个还不存在的人：就地给他一个身份
        if (!id && (args.name || args.who)) {
          const nm = String(args.name || args.who).trim().slice(0, 8);
          id = `npc_${Object.keys(world.actors || {}).length}`;
          world.actors[id] = {
            id,
            name: nm,
            role: off.title,
            gender: 'male',
            kind: 'official',
            office: post,
            household: false,
            home: 'yamen',
            location: 'yamen',
            relations: { husband: { trust: 40, desire: 0, fear: 0, grievance: 0 } },
            goals: ['坐稳这位子', '报答提拔之恩'],
            secret: '原是相公门下的人',
            schedule: [],
          };
        }
        if (!id || !world.actors[id]) continue;
        off.holder = id;
        off.vacant = false;
        world.actors[id].office = post;
        world.actors[id].role = off.title;
        world.reputation = Math.min(100, (Number(world.reputation) || 50) + 10);
        applied.push(`${world.actors[id].name} 接任${off.title}`);
      } else if (kind === 'tax') {
        // 定税率：税高民心散，税低民心归
        const cityName = String(args.city || args.name || '').trim();
        world.cities = world.cities || {};
        const ct = world.cities[cityName];
        if (!ct) continue;
        const rate = Math.max(0, Math.min(50, Number(args.rate ?? args.value) || 0));
        ct.tax = rate;
        applied.push(`税率:${cityName} ${rate}%`);
      } else if (kind === 'reputation') {
        const delta = Number(args.delta);
        if (!Number.isFinite(delta)) continue;
        world.reputation = Math.max(0, Math.min(100, (Number(world.reputation) || 50) + delta));
        applied.push(`名声${delta >= 0 ? '+' : ''}${delta}→${world.reputation}`);
      } else if (kind === 'wanted') {
        const delta = Number(args.delta);
        if (!Number.isFinite(delta)) continue;
        world.wanted = Math.max(0, Math.min(100, (Number(world.wanted) || 0) + delta));
        applied.push(`通缉${delta >= 0 ? '+' : ''}${delta}→${world.wanted}`);
      } else if (kind === 'venue') {
        // 场所：给地点加上"这是干什么的"
        const placeName = String(args.place || '').trim();
        const kindName = String(args.kind || '').trim().slice(0, 8);
        if (!placeName || !kindName) continue;
        world.places = world.places || {};
        const pid = Object.keys(world.places).find((id) => {
          const n = String(world.places[id]?.name || '');
          return n === placeName || n.includes(placeName);
        }) || null;
        if (!pid) continue;
        world.places[pid].kind = kindName;
        applied.push(`场所:${world.places[pid].name}=${kindName}`);
      } else if (kind === 'siege') {
        // 攻城：兵力 vs 守备，结果由算式 + 少量随机决定
        const cityName = String(args.city || args.name || '').trim();
        world.cities = world.cities || {};
        const ct = world.cities[cityName];
        if (!ct) continue;
        const who = String(args.by || args.who || 'husband');
        const mil = forceOf(world, who);
        const infra = world.infra || {};
        const ownerId = who === 'husband' ? 'wangjia' : `actor_${who}`;
        if (ct.owner === ownerId) continue;
        if (who !== 'husband' && !world.powers[ownerId]) {
          const an = world.actors?.[who]?.name || who;
          world.powers[ownerId] = { name: `${an}的部曲`, kind: '私兵', power: 3, relation: 0, troops: 0, note: '', ownerActor: who };
        }
        // 盟友的兵来助战（各出一半）
        let allyPower = 0;
        const allyNames = [];
        for (const allyId of world.allies?.[who] || []) {
          const af = world.forces?.[allyId] || (allyId === 'husband' ? world.military : null);
          if (!af) continue;
          allyPower += ((Number(af.army) || 0) + (Number(af.militia) || 0) * 0.6) * 0.5;
          if (world.actors?.[allyId]?.name) allyNames.push(world.actors[allyId].name);
        }
        if (allyPower > 0) applied.push(`合兵:${allyNames.join('、')}`);
        const ours =
          (Number(mil.army) || 0) +
          (Number(mil.militia) || 0) * 0.6 +
          (Number(mil.guards) || 0) * 0.3 +
          allyPower;
        if (ours <= 0) {
          applied.push('攻城:无兵可战');
          continue;
        }
        const oursPower =
          ours *
          (1 + (Number(mil.quality) || 0) / 200) *
          (1 + (Number(mil.morale) || 0) / 200) *
          (1 + (Number(infra.workshop) || 0) / 20);
        const theirPower = (Number(ct.defense) || 10) * (1 + (Number(ct.unrest) || 0) / 200);
        const roll = 0.85 + Math.random() * 0.3;
        const win = oursPower * roll > theirPower;
        if (win) {
          ct.owner = ownerId;
          // 城破：原来的父母官倒了，位子空出来等人接
          const offKey = `city:${cityName}`;
          const off = world.court?.offices?.[offKey];
          if (off && off.holder) {
            const oldOff = world.actors?.[off.holder];
            if (oldOff) {
              oldOff.dead = true;
              oldOff.deadDay = world.clock.day;
            }
            off.holder = null;
            off.vacant = true;
            applied.push(`${cityName}知府已除（位子空着）`);
          }
          ct.defense = Math.max(1, Math.round((Number(ct.defense) || 10) / 2));
          ct.unrest = Math.min(100, (Number(ct.unrest) || 0) + 20);
          applied.push(`攻城:${cityName} 已下`);
          events.push(
            nextEvent(world, {
              action: 'siege_win',
              actor: 'husband',
              place: ct.region || null,
              payload: { text: `攻下${cityName}` },
              isPublic: true,
            }),
          );
        } else {
          const loss = Math.max(1, Math.round(ours * 0.25));
          const takeArmy = Math.min(Number(mil.army) || 0, Math.round(loss * 0.5));
          mil.army = Math.max(0, (Number(mil.army) || 0) - takeArmy);
          const rest = Math.max(0, loss - takeArmy);
          mil.militia = Math.max(0, (Number(mil.militia) || 0) - rest);
          mil.morale = Math.max(0, (Number(mil.morale) || 0) - 15);
          applied.push(`攻城:${cityName} 未下（折损${loss}，士气-15）`);
          events.push(
            nextEvent(world, {
              action: 'siege_lose',
              actor: 'husband',
              place: ct.region || null,
              payload: { text: `攻打${cityName}受挫` },
              isPublic: true,
            }),
          );
        }
      } else if (kind === 'power') {
        // 新势力：立旗号、拉队伍
        const name = String(args.name || '').trim().slice(0, 20);
        if (!name) continue;
        world.powers = world.powers || {};
        const id = String(args.id || `p_${Object.keys(world.powers).length + 1}`).slice(0, 16);
        if (!world.powers[id]) {
          world.powers[id] = { ownerActor: String(args.who || selfId || 'husband'),
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
        const who = String(args.who || 'husband');
        const f = forceOf(world, who);
        f[field] = Math.max(0, (Number(f[field]) || 0) + delta);
        applied.push(`${field}${delta >= 0 ? '+' : ''}${delta}→${f[field]}`);
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
