/**
 * 银两流水：钱一动，账上就有一笔。
 *
 * 以前银子是散落在各处直接加减（产业进账、月例、房钱、打点…），
 * 于是"钱少了但不知道花在哪"。
 * 现在所有进出都走这里，写一条 world.ledger：
 *   { day, hour, delta, title, by, balance }
 */

import { moneyCategory, JUNK_PLACE } from './ledger-rules.js';

const MAX = 300;

/**
 * 归一化花销/产业开张标题的核心标的（如「王记当铺开张·开张」与「王记当铺开张本钱，取银入公账」均归为「王记当铺」）
 */
export function normalizeSpendSubject(title = '') {
  return String(title || '')
    .replace(/[·,，。、\s（）()【】「」]/g, '')
    .replace(/^(?:置办|购置|盘下|打制|开办|采买|兴建|设立|筹建|新开|支付|付清|拨付)/, '')
    .replace(/(?:开张本钱取银入公账|开张本钱|开张|开业本钱|开业|取银入公账|入公账|本钱|启动银|盘铺银|盘铺|置办|装修|定金|尾款|全款|银两|花销|开销)+$/g, '')
    .trim();
}

/**
 * 判断两个花销标题是否指向同一实业/同一事由
 */
export function isSameSpendSubject(titleA = '', titleB = '') {
  const a = normalizeSpendSubject(titleA);
  const b = normalizeSpendSubject(titleB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))) return true;
  // 尾部核心字号/业态相同（如「码头南门青石板三处堆栈」与「码头三处堆栈」均以「三处堆栈」结尾，或同为「当铺/堆栈/钱庄」）
  if (a.length >= 2 && b.length >= 2 && a.slice(-2) === b.slice(-2) && /(?:当铺|堆栈|货栈|酒楼|茶坊|钱庄|银号|米行|盐铺|药铺|医馆|布庄|绸缎|镖局|船队|货船|大船|马场|铁匠|瓷窑)/.test(a.slice(-2))) {
    return true;
  }
  return false;
}

/**
 * 查找同日是否已存在同金额、同标的的扣款流水（单一写入口防重锁）
 */
export function findSameDayDuplicateSpend(world, amount, title, day = world?.clock?.day || 1) {
  const a = Math.abs(Math.round(Number(amount) * 100) / 100);
  if (!(a >= 10)) return null;
  const list = Array.isArray(world?.ledger) ? world.ledger : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (!e || Number(e.day) !== Number(day) || !(Number(e.delta) < 0)) continue;
    if (Math.abs(Math.abs(Number(e.delta)) - a) > 0.01) continue;
    if (isSameSpendSubject(e.title, title)) return e;
  }
  return null;
}

export function appendLedger(world, { delta = 0, title = '', by = 'husband' } = {}) {
  const amount = Math.round(Number(delta) * 100) / 100;
  if (!amount) return null;
  // 入账资格：标题不能是"付3两"这类话，且必须能归入白名单类别
  let cleanTitle = String(title || (amount > 0 ? '进账' : '花销')).slice(0, 24);
  if (JUNK_PLACE.test(cleanTitle)) cleanTitle = amount > 0 ? '进账' : '开销';
  world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
  // 单一写入口幂等保护：同日同金额同标的的大额支出流水绝不重复入账
  if (amount < 0 && Math.abs(amount) >= 10) {
    const dup = findSameDayDuplicateSpend(world, Math.abs(amount), cleanTitle, world.clock?.day || 1);
    if (dup) {
      console.log(`[Ledger] 拦截重复流水入账：${cleanTitle} (${amount}两) 与同日「${dup.title}」重复`);
      return dup;
    }
  }
  const entry = {
    day: world.clock?.day || 1,
    hour: world.clock?.hour || 0,
    delta: amount,
    title: cleanTitle,
    category: moneyCategory(cleanTitle, amount),
    by,
    balance: Math.round((Number(world.assets?.silver) || 0) * 100) / 100,
  };
  world.ledger.push(entry);
  if (world.ledger.length > MAX) world.ledger = world.ledger.slice(-MAX);
  return entry;
}

/** 花钱：扣账 + 记流水，钱不够返回 false（不扣）；同日同标的同金额自动幂等免重扣 */
export function spendSilver(world, amount, title, by = 'husband') {
  const a = Math.round(Number(amount) * 100) / 100;
  if (!(a > 0)) return { ok: false, error: '金额不对' };
  const dup = findSameDayDuplicateSpend(world, a, title, world?.clock?.day || 1);
  if (dup) {
    console.log(`[Ledger] 拦截同日同标的重复扣银：${title} (-${a}两) 已由「${dup.title}」核销`);
    return { ok: true, deduplicated: true, duplicateOf: dup.title, balance: Number(world.assets?.silver) || 0 };
  }
  const silver = Number(world.assets?.silver) || 0;
  if (silver < a) return { ok: false, error: `钱不够：要 ${a} 两，手头 ${silver.toFixed(2)} 两` };
  world.assets.silver = Math.round((silver - a) * 100) / 100;
  appendLedger(world, { delta: -a, title, by });
  return { ok: true, balance: world.assets.silver };
}

/** 进账：加钱 + 记流水 */
export function earnSilver(world, amount, title, by = 'husband') {
  const a = Math.round(Number(amount) * 100) / 100;
  if (!(a > 0)) return { ok: false, error: '金额不对' };
  const silver = Number(world.assets?.silver) || 0;
  world.assets.silver = Math.round((silver + a) * 100) / 100;
  appendLedger(world, { delta: a, title, by });
  return { ok: true, balance: world.assets.silver };
}

/** 最近几笔 */
export function recentLedger(world, n = 8) {
  return (world.ledger || []).slice(-n).reverse();
}


/**
 * 每日对账：昨日开盘银子 + 当日流水合计 = 今日子弹？不对就是账有问题
 * @returns {{ok:boolean, diff:number, expected:number, actual:number}}
 */
export function reconcileMoney(world, day) {
  const open = Number(world?.flags?.dayOpenSilver);
  if (!Number.isFinite(open)) return { ok: true, diff: 0, expected: 0, actual: 0 };
  const actual = Math.round((Number(world?.assets?.silver) || 0) * 100) / 100;
  const sum = (Array.isArray(world?.ledger) ? world.ledger : [])
    .filter((e) => e && Number(e.day) === Number(day))
    .reduce((s, e) => s + (Number(e.delta) || 0), 0);
  const expected = Math.round((open + sum) * 100) / 100;
  const diff = Math.round((actual - expected) * 100) / 100;
  const ok = Math.abs(diff) <= 0.05;
  if (!ok) {
    world.flags = world.flags || {};
    world.flags.moneyAudit = { day: Number(day), open, sum: Math.round(sum * 100) / 100, expected, actual, diff, at: Date.now() };
    console.warn(`[Money] 账不平：第${day}日 期初${open} + 流水${Math.round(sum * 100) / 100} = ${expected}，实际 ${actual}，差 ${diff}`);
  }
  world.flags.dayOpenSilver = actual;
  return { ok, diff, expected, actual };
}
