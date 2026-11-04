/**
 * 银两：一个人的钱只有一个出处。
 *
 * 以前三处各存一份：
 *   · 相公 → assets.silver（公账）
 *   · 成员 → world.wallets[id]
 *   · 角色 → actor.money
 * 于是「注册时说 20 两，App 里显示 0 两」——两处各读各的。
 *
 * 现在：
 *   相公  → assets.silver
 *   其他人 → actor.money 为唯一真相，wallets 只是镜像（历史代码还在读它）
 * 所有读写都走这里，别处不再直接摸钱包。
 */

import { appendLedger } from './ledger.js';

export function getMoney(world, actorId) {
  if (!actorId || actorId === 'husband') return Math.round((Number(world?.assets?.silver) || 0) * 100) / 100;
  const a = world?.actors?.[actorId];
  const fromActor = Number(a?.money);
  if (Number.isFinite(fromActor)) return Math.round(fromActor * 100) / 100;
  return Math.round((Number(world?.wallets?.[actorId]) || 0) * 100) / 100;
}

export function setMoney(world, actorId, value) {
  const v = Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
  if (!actorId || actorId === 'husband') {
    world.assets = world.assets || {};
    world.assets.silver = v;
    return v;
  }
  const a = world.actors?.[actorId];
  if (a) a.money = v;
  // 镜像给还在读 wallets 的老代码
  world.wallets = world.wallets || {};
  world.wallets[actorId] = v;
  return v;
}

export function addMoney(world, actorId, delta, title = '', by = 'husband') {
  const d = Math.round((Number(delta) || 0) * 100) / 100;
  if (!d) return { ok: false, error: '金额为 0' };
  const cur = getMoney(world, actorId);
  setMoney(world, actorId, cur + d);
  if (title) {
    // 只有公账走 ledger（个人钱包暂不建流水，避免两套账）
    if (!actorId || actorId === 'husband') appendLedger(world, { delta: d, title, by });
  }
  return { ok: true, balance: getMoney(world, actorId) };
}

export function spendMoney(world, actorId, amount, title = '', by = 'husband') {
  const a = Math.round((Number(amount) || 0) * 100) / 100;
  if (!(a > 0)) return { ok: false, error: '金额不对' };
  const cur = getMoney(world, actorId);
  if (cur < a) return { ok: false, error: `钱不够：要 ${a} 两，手头 ${cur.toFixed(2)} 两` };
  setMoney(world, actorId, cur - a);
  if (!actorId || actorId === 'husband') appendLedger(world, { delta: -a, title, by });
  return { ok: true, balance: getMoney(world, actorId) };
}

/** 读档时对齐：actor.money 与 wallets 谁有值听谁的，缺的一边补上 */
export function syncMoney(world) {
  let fixed = 0;
  world.wallets = world.wallets || {};
  for (const [id, a] of Object.entries(world.actors || {})) {
    if (!a || id === 'husband') continue;
    const hasActor = Number.isFinite(Number(a.money)) && a.money !== null && a.money !== undefined;
    const hasWallet = Object.prototype.hasOwnProperty.call(world.wallets, id);
    if (hasActor && !hasWallet) {
      world.wallets[id] = Math.round(Number(a.money) * 100) / 100;
      fixed += 1;
    } else if (!hasActor && hasWallet) {
      a.money = Math.round(Number(world.wallets[id]) * 100) / 100;
      fixed += 1;
    }
  }
  return fixed;
}
