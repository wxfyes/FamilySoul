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
  for (const c of new Set(text.match(/([一-龥]{2}府)/g) || [])) {
    if (!cityNames.includes(c)) {
      issues.push({ kind: 'reply', level: 'warn', text: `她提到了「${c}」，疆域里没有这座府` });
    }
  }
  return issues;
}

/** 全量自检 */
export function auditAll(world) {
  const ledger = auditWorld(world).map((t) => ({ kind: 'ledger', level: 'bad', text: t }));
  const memory = auditMemories(world);
  const reply = Array.isArray(world.auditIssues) ? world.auditIssues.slice(-12) : [];
  const all = [...ledger, ...memory, ...reply];
  return {
    ledger,
    memory,
    reply,
    counts: {
      ledger: ledger.length,
      memory: memory.length,
      reply: reply.length,
      bad: all.filter((x) => x.level === 'bad').length,
    },
  };
}
