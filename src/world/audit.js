/**
 * 世界账本体检 —— 纯代码，零 LLM 调用，零 token
 *
 * 三道自检：
 * ① 账本本身有没有坏（越界、失效、堆积、非法数值）
 * ② 记忆里提到的事，和账本对不对得上
 * ③ 台词里的数字/日期/地名，和账本差多少
 *
 * 铁律：只报告，不擅自改世界。要改必须人来点头。
 */

function walkNumbers(obj, pathStr, out, depth = 0) {
  if (depth > 8 || obj === null || obj === undefined) return;
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) out.push(`非法数值 ${pathStr} = ${obj}`);
    return;
  }
  if (typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) walkNumbers(v, `${pathStr}.${k}`, out, depth + 1);
}

/**
 * @param {object} world loadState 出来的世界对象
 * @returns {string[]} 问题清单（空数组 = 健康）
 */
export function auditWorld(world) {
  const issues = [];
  if (!world || typeof world !== 'object') return ['世界对象缺失'];

  // 资产
  if (!(Number(world.assets?.silver) >= 0)) issues.push(`现银非法: ${world.assets?.silver}`);
  for (const p of world.assets?.properties || []) {
    if (!(Number(p?.incomePerDay) >= 0)) issues.push(`产业收入非法: ${p?.name}=${p?.incomePerDay}`);
  }

  // 人物
  for (const a of Object.values(world.actors || {})) {
    if (!a) continue;
    const rel = a.relations?.husband;
    if (rel) {
      for (const f of ['trust', 'desire', 'fear', 'grievance']) {
        const v = rel[f];
        if (typeof v === 'number' && (v < 0 || v > 100)) issues.push(`关系越界: ${a.name}.${f}=${v}`);
      }
    }
    if (a.location && !world.places?.[a.location]) issues.push(`位置失效: ${a.name}@${a.location}`);
  }

  // 堆积
  const cap = (arr, n, label) => {
    if (Array.isArray(arr) && arr.length > n) issues.push(`${label}堆积 ${arr.length} 条`);
  };
  cap(world.pending, 8, '暗涌');
  cap(world.proactive, 8, '推送');
  cap(world.memories, 120, '记忆');
  cap(world.clues, 60, '线索');
  cap(world.appointments, 20, '约定');

  // 地点重名
  const names = Object.values(world.places || {}).map((p) => p?.name);
  if (new Set(names).size !== names.length) issues.push('存在重名地点');

  // 约定是否已经过期还没触发
  const nowHour = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
  const overdue = (world.appointments || []).filter((a) => Number(a?.day) * 24 + Number(a?.hour) < nowHour - 24);
  if (overdue.length > 0) issues.push(`有 ${overdue.length} 条约定过期未触发`);

  // 全量数字健康
  walkNumbers(world, 'world', issues);

  return [...new Set(issues)];
}

function cnNum(s) {
  const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const unit = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let cur = 0;
  for (const ch of String(s)) {
    if (map[ch] !== undefined) cur = map[ch];
    else if (unit[ch]) {
      total += (cur || 1) * unit[ch];
      cur = 0;
    }
  }
  return total + cur;
}

function parseAmount(raw) {
  const s = String(raw || '');
  if (/^\d/.test(s)) return Number(s);
  if (/[一二三四五六七八九十百千两]/.test(s)) return cnNum(s);
  return null;
}

function toNum(s) {
  const m = String(s || '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** ② 记忆自检：记忆说的事，账本里对不对得上 */
export function auditMemories(world) {
  const issues = [];
  const memories = Array.isArray(world.memories) ? world.memories : [];
  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];

  for (const m of memories) {
    const text = String(m?.text || '');
    if (!text) {
      issues.push({ kind: 'memory', level: 'warn', text: '有一条空记忆' });
      continue;
    }
    for (const p of props) {
      if (!p?.name) continue;
      const nm = String(p.name);
      const hitName = [nm, nm.slice(-2), nm.slice(-3), nm.slice(0, 3)].some((x) => x && text.includes(x));
      if (!hitName) continue;
      const short = nm.slice(-3);
      const saysPreparing = /筹备|未开张|还没开/.test(text);
      const saysOpen = /开张|营业|开业/.test(text);
      const isOpen = /开张|营业|开业/.test(String(p.status || ''));
      if (saysPreparing && isOpen) {
        issues.push({ kind: 'memory', level: 'bad', text: `记忆说「${short}筹备」，账本已是「${p.status}」` });
      }
      if (saysOpen && !isOpen) {
        issues.push({ kind: 'memory', level: 'bad', text: `记忆说「${short}已开张」，账本还是「${p.status || '未知'}」` });
      }
    }
  }

  const seen = new Map();
  for (const m of memories) {
    const key = String(m?.text || '').slice(0, 20);
    if (!key) continue;
    if (seen.has(key)) issues.push({ kind: 'memory', level: 'warn', text: `记忆重复：「${key}…」` });
    else seen.set(key, true);
  }
  return issues;
}

/** ③ 台词自检：这一句回复里的数字/日期/地名，和账本差多少 */
export function auditReply(reply, world) {
  const issues = [];
  const text = String(reply || '');
  if (!text) return issues;
  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];

  for (const seg of text.match(/日入[^0-9一二三四五六七八九十百]{0,6}([0-9]+(?:\.[0-9]+)?|[一二三四五六七八九十百千]+)\s*两/g) || []) {
    const v = parseAmount(String(seg).replace(/^日入[^0-9一二三四五六七八九十百]*/, "").replace(/\s*两$/, ""));
    if (v == null) continue;
    if (!props.some((p) => Math.abs(Number(p.incomePerDay) - v) < 0.01)) {
      const real = props.map((p) => `${p.name}${p.incomePerDay}两`).join('、');
      issues.push({ kind: 'reply', level: 'warn', text: `她说了「${seg}」，账本对不上（${real || '无产业'}）` });
    }
  }

  const silverM = text.match(/现银[^0-9一二三四五六七八九十百]{0,4}([0-9]+(?:\.[0-9]+)?|[一二三四五六七八九十百千]+)\s*两/) || text.match(/([0-9]+(?:\.[0-9]+)?|[一二三四五六七八九十百千]+)\s*两现银/);
  if (silverM) {
    const v = parseAmount(silverM[1]);
    const real = Number(world.assets?.silver) || 0;
    if (Math.abs(v - real) > Math.max(1, real * 0.05)) {
      issues.push({ kind: 'reply', level: 'bad', text: `她说了「${v}两现银」，账本是 ${real} 两` });
    }
  }

  const dayM = text.match(/第\s*([0-9]+|[一二三四五六七八九十百]+)\s*日/);
  if (dayM) {
    const v = parseAmount(dayM[1]);
    const real = Number(world.clock?.day) || 1;
    if (Math.abs(v - real) > 1) {
      issues.push({ kind: 'reply', level: 'warn', text: `她说了「第${v}日」，世界是第${real}日` });
    }
  }

  const cityNames = Object.keys(world.cities || {});
  const BAD_WORDS = /(知|到|是|了|回|去|本|该|官|县|州|王|李|张|刘|陈|这|那|一|两|三)/;
  // 只在"去/往/到/在/回/至 + X府"这种明确说法里查，且排除官名与虚词
  for (const m of text.matchAll(/(?:去|往|到|在|回|至)([一-龥]{2}府)/g)) {
    const c = m[1];
    if (cityNames.includes(c)) continue;
    if (BAD_WORDS.test(c)) continue;
    issues.push({ kind: 'reply', level: 'warn', text: `她提到了「${c}」，疆域里没有这座府` });
  }
  return issues;
}

/** ④ 归属自检：凡有主的东西，必须写清主人 */
export function auditOwnership(world) {
  const issues = [];
  for (const [id, p] of Object.entries(world.places || {})) {
    if (!p || p.owner) continue;
    issues.push({ kind: 'own', level: 'warn', text: `地点无主：${p.name || id}` });
  }
  for (const pr of world.assets?.properties || []) {
    if (!pr || pr.owner) continue;
    issues.push({ kind: 'own', level: 'warn', text: `产业无主：${pr.name || pr.id}` });
  }
  for (const [name, ct] of Object.entries(world.cities || {})) {
    if (!ct || ct.owner) continue;
    issues.push({ kind: 'own', level: 'bad', text: `城池无主：${name}` });
  }
  for (const [id, pw] of Object.entries(world.powers || {})) {
    if (!pw || pw.ownerActor || id === 'court') continue;
    issues.push({ kind: 'own', level: 'warn', text: `势力无主：${pw.name || id}` });
  }
  for (const c of world.clues || []) {
    if (!c || c.owner) continue;
    issues.push({ kind: 'own', level: 'warn', text: `线索无主：${String(c.text || '').slice(0, 12)}` });
  }
  return issues;
}

/** 全量自检 */
export function auditAll(world) {
  // 一次性清账：把历史上误报的假地名丢掉
  if (Array.isArray(world.auditIssues)) {
    world.auditIssues = world.auditIssues.filter((x) => {
      const m = String(x?.text || '').match(/她提到了「([^」]+)」/);
      if (!m) return true;
      if (!/府$/.test(m[1])) return true;
      return !/(知|到|是|了|回|去|本|该|官|县|州)/.test(m[1]);
    });
  }
  const ledger = auditWorld(world).map((t) => ({ kind: 'ledger', level: 'bad', text: t }));
  const memory = auditMemories(world);
  const ownership = auditOwnership(world);
  // 只留最近两天的台词告警：老账不翻，免得早修好的问题一直挂着
  const today = Number(world.clock?.day) || 1;
  const BAD_CITY = /(知|到|是|了|回|去|本|该|官|县|州|这|那|一|两|三)/;
  const reply = Array.isArray(world.auditIssues)
    ? world.auditIssues
      .filter((x) => x && (!x.day || today - Number(x.day) <= 1))
      .filter((x) => {
        // 按现在的规则重新判一遍：假地名（就是府/到府/张知府）不再报
        const m = String(x?.text || '').match(/她提到了「([^」]+)」/);
        if (!m) return true;
        const name = m[1];
        if (!/府$/.test(name)) return true;
        return BAD_CITY.test(name) ? false : true;
      })
      .slice(-12)
    : [];
  const all = [...ledger, ...memory, ...ownership, ...reply];
  return {
    ledger,
    memory,
    ownership,
    reply,
    counts: {
      memory: memory.length,
      ownership: ownership.length,
      reply: reply.length,
      bad: all.filter((x) => x.level === 'bad').length,
    },
  };
}

/** 关系网自检：不许指向不存在的人 */
export function auditBonds(world) {
  const issues = [];
  for (const [a, map] of Object.entries(world?.bonds || {})) {
    if (!world.actors?.[a]) { issues.push(`关系网里有不存在的人：${a}`); continue; }
    for (const b of Object.keys(map || {})) {
      if (!world.actors?.[b]) issues.push(`${world.actors[a]?.name || a} 的关系指向不存在的人：${b}`);
    }
  }
  return issues;
}

/* ── 结构体检 + 天道修账（每日一次） ───────────────────────
 * 引擎只找"不成立"的事实，怎么修由天道定；它没修的，引擎按最保守办法兜底。
 */

export function inspectStructure(world) {
  const issues = [];
  const places = world.places || {};
  const actors = world.actors || {};

  for (const [id, a] of Object.entries(actors)) {
    if (!a || !a.name) continue;
    if (a.location && !places[a.location]) {
      issues.push({ kind: 'pos', who: a.name, id, detail: `站在不存在的地方(${a.location})` });
    }
    if (a.dead && a.location) {
      issues.push({ kind: 'dead', who: a.name, id, detail: '已故却仍有行踪' });
    }
    if (typeof a.money === 'number' && a.money < 0) {
      issues.push({ kind: 'money', who: a.name, id, detail: `私房钱为负(${a.money})` });
    }
    if (a.pregnancy && !a.pregnancy.born && Number(a.age) > 48) {
      issues.push({ kind: 'preg', who: a.name, id, detail: `${a.age}岁仍有身孕` });
    }
  }

  if (Number(world.assets?.silver) < 0) {
    issues.push({ kind: 'silver', detail: `公账为负(${world.assets.silver})` });
  }

  const seen = new Map();
  for (const [id, pl] of Object.entries(places)) {
    if (!pl?.name) { issues.push({ kind: 'place', id, detail: '地点没有名字' }); continue; }
    if (seen.has(pl.name)) issues.push({ kind: 'place', id, detail: `与${seen.get(pl.name)}重名：${pl.name}` });
    else seen.set(pl.name, id);
    const ex = Array.isArray(pl.exits) ? pl.exits.filter((x) => places[x]) : [];
    if (!ex.length && id !== 'street') issues.push({ kind: 'place', id, detail: `「${pl.name}」没有出处` });
  }

  // 没有来历的人：世界里的每个人都有出处，孤儿要被认领或清掉
  for (const [id, a] of Object.entries(actors)) {
    if (!a || !a.name || a.dead || a.id === 'husband') continue;
    // 只查"被雇的人"：普通居民有自己的住处就是来历，不必有雇工记录
    const employed = Boolean(a.employer && a.workplace) || Boolean(a.sourceTask);
    if (employed && !a.hiredBy && !a.sourceTask) {
      issues.push({ kind: 'orphan', who: a.name, id, detail: `${a.name}（${a.role || '来路不明'}）没有来历` });
    }
  }

  // 产业有没有人在岗：开张却空无一人的，报给天道
  for (const prop of world.assets?.properties || []) {
    if (!prop || !prop.placeId) continue;
    const roster = Array.isArray(prop.staffIds) ? prop.staffIds.filter((id) => actors[id] && !actors[id].dead) : [];
    const onDuty = roster.filter((id) => actors[id].location === prop.placeId);
    if (!roster.length && prop.status === '已开张') {
      // 名册里一个人都没有 = 真的还没请人；只是临时外出不算
      issues.push({ kind: 'staff', who: prop.name, detail: `「${prop.name}」开着却还没请人` });
    } else {
      prop.staff = onDuty.length;
    }
  }

  for (const ap of world.appointments || []) {
    if (ap && ap.place && !places[ap.place]) {
      issues.push({ kind: 'apt', detail: `约定指向不存在的地点(${ap.place})` });
    }
  }

  return issues;
}

export function buildRepairPrompt(world, issues) {
  const lines = issues.slice(0, 24).map((i) => `- [${i.kind}] ${i.who || i.id || ''}：${i.detail}`);
  const system = [
    '你是这个世界的天道。人间出了这些不成立的事，需要你定夺。',
    '只输出 JSON：',
    '{"fixes":[{"kind":"pos","who":"人名","place":"送到哪个现成地点名（可空）","note":"一句话交代"}]}',
    '规矩：能用现成地点就用现成的；人必须有个落脚处；钱不许是负的；死人不许再走动。',
    '若某个产业开着却没人在岗，就在 fixes 里给一条 {"kind":"staff","who":"产业名","name":"人名","role":"身份"}，起个像样的名字。',
    '拿不准的可以跳过，宁缺毋滥。',
  ].join('\n');
  const user = [
    `第${world.clock?.day || 1}日 ${world.clock?.hour || 0}时，人间自检：`,
    ...lines,
    '',
    '现成地点：' + Object.values(world.places || {}).filter((p) => p?.name).slice(0, 80).map((p) => p.name).join('、'),
    '请给修法，输出 JSON。',
  ].join('\n');
  return { system, user };
}

export function applyRepairs(world, text) {
  const raw = String(text || '');
  const m = raw.match(/\{[\s\S]*\}/);
  let fixes = [];
  if (m) {
    try {
      const data = JSON.parse(m[0]);
      fixes = Array.isArray(data?.fixes) ? data.fixes : [];
    } catch { /* 忽略 */ }
  }
  const nameToPlace = new Map();
  for (const [id, pl] of Object.entries(world.places || {})) if (pl?.name) nameToPlace.set(String(pl.name), id);

  let fixed = 0;
  for (const f of fixes) {
    const who = String(f?.who || '');
    const target = f?.place ? nameToPlace.get(String(f.place)) : null;
    const actor = world.actors?.[who] || Object.values(world.actors || {}).find((a) => a?.name === who);
    if (actor) {
      if (f?.kind === 'pos' || f?.kind === 'dead') {
        if (actor.dead) delete actor.location;
        else moveActor(world, actor.id, target || 'street', 'world', '自检归位');
        fixed += 1;
      } else if (f?.kind === 'money') {
        actor.money = Math.max(0, Number(actor.money) || 0);
        fixed += 1;
      } else if (f?.kind === 'preg') {
        delete actor.pregnancy;
        fixed += 1;
      }
      continue;
    }
    if (f?.kind === 'staff') {
      const r = hireStaff(world, { propName: f?.who, name: f?.name, role: f?.role || '伙计', via: 'audit' });
      if (r.ok) fixed += 1;
      continue;
    }

    if (f?.kind === 'place') {
      const pid = world.places?.[who] ? who : nameToPlace.get(who);
      if (pid && world.places[pid]) {
        const pl = world.places[pid];
        const ex = Array.isArray(pl.exits) ? pl.exits.filter((x) => world.places?.[x]) : [];
        if (!ex.length) {
          const back = world.places.street ? 'street'
            : Object.keys(world.places).find((k) => k !== pid) || null;
          if (back) { pl.exits = [back]; fixed += 1; }
        }
      }
    }
  }

  // 天道没修的硬错，按最保守办法兜底
  for (const [id, a] of Object.entries(world.actors || {})) {
    if (!a || !a.name) continue;
    if (a.dead) { if (a.location) { delete a.location; fixed += 1; } continue; }
    if (a.location && !world.places?.[a.location]) { a.location = 'street'; fixed += 1; }
    if (typeof a.money === 'number' && a.money < 0) { a.money = 0; fixed += 1; }
    if (Number(a.age) > 48 && a.pregnancy && !a.pregnancy.born) { delete a.pregnancy; fixed += 1; }
  }
  if (Number(world.assets?.silver) < 0) { world.assets.silver = 0; fixed += 1; }

  // 孤儿地点：没有出口就当街立着（不然人进去了出不来）
  for (const [id, pl] of Object.entries(world.places || {})) {
    if (!pl || !pl.name || id === 'street') continue;
    const ex = Array.isArray(pl.exits) ? pl.exits.filter((x) => world.places?.[x]) : [];
    if (ex.length) continue;
    const back = world.places.street ? 'street' : Object.keys(world.places).find((k) => k !== id);
    if (back) { pl.exits = [back]; fixed += 1; }
  }

  return { fixed, fromDm: fixes.length };
}
