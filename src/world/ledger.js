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

export function appendLedger(world, { delta = 0, title = '', by = 'husband' } = {}) {
  const amount = Math.round(Number(delta) * 100) / 100;
  if (!amount) return null;
  // 入账资格：标题不能是"付3两"这类话，且必须能归入白名单类别
  let cleanTitle = String(title || (amount > 0 ? '进账' : '花销')).slice(0, 24);
  if (JUNK_PLACE.test(cleanTitle)) cleanTitle = amount > 0 ? '进账' : '开销';
  world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
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

/** 花钱：扣账 + 记流水，钱不够返回 false（不扣） */
export function spendSilver(world, amount, title, by = 'husband') {
  const a = Math.round(Number(amount) * 100) / 100;
  if (!(a > 0)) return { ok: false, error: '金额不对' };
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
