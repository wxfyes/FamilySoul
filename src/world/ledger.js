/**
 * 银两流水：钱一动，账上就有一笔。
 *
 * 以前银子是散落在各处直接加减（产业进账、月例、房钱、打点…），
 * 于是"钱少了但不知道花在哪"。
 * 现在所有进出都走这里，写一条 world.ledger：
 *   { day, hour, delta, title, by, balance }
 */

const MAX = 300;

export function appendLedger(world, { delta = 0, title = '', by = 'husband' } = {}) {
  const amount = Math.round(Number(delta) * 100) / 100;
  if (!amount) return null;
  world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
  const entry = {
    day: world.clock?.day || 1,
    hour: world.clock?.hour || 0,
    delta: amount,
    title: String(title || (amount > 0 ? '进账' : '花销')).slice(0, 24),
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
