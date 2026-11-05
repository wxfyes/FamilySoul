/**
 * 商货：盐、茶、丝、铁、药——真的买进卖出，不是只有指数。
 *
 * 存货记在 world.assets.goods = { salt: 0, tea: 0, ... }
 * 价：prices.priceAt(world, 城, 货) —— 随全囯指数与城的景气浮动
 * 买卖都走这里：钱与货对得上，绝不凭空生货。
 */

import { priceAt, COMMODITIES } from './prices.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;

const GOODS = ['salt', 'tea', 'silk', 'iron', 'herb'];

export function ensureGoods(world) {
  world.assets = world.assets && typeof world.assets === 'object' ? world.assets : {};
  world.assets.goods = world.assets.goods && typeof world.assets.goods === 'object' ? world.assets.goods : {};
  for (const g of GOODS) {
    if (!(num(world.assets.goods[g]) >= 0)) world.assets.goods[g] = 0;
  }
  return world.assets.goods;
}

/** 某城某货的市价 */
export function goodPrice(world, cityName, good) {
  if (!COMMODITIES[good]) return 0;
  return priceAt(world, cityName, good);
}

/**
 * 买货
 * @returns {{ok:boolean, error?:string, qty?:number, cost?:number, goods?:object}}
 */
export function buyGoods(world, actorId, { city, good, qty }) {
  const g = ensureGoods(world);
  if (!COMMODITIES[good]) return { ok: false, error: '没有这种货' };
  const cityName = city && world.cities?.[city] ? city : Object.keys(world.cities || {})[0];
  if (!cityName) return { ok: false, error: '没有这座城' };
  const n = Math.max(1, Math.min(5000, Math.round(num(qty))));
  const unit = goodPrice(world, cityName, good);
  const cost = round2(n * unit);
  const silver = num(world.assets.silver);
  if (silver < cost) return { ok: false, error: `银不够：${n} 单位${COMMODITIES[good].name}要 ${cost} 两` };
  world.assets.silver = round2(silver - cost);
  g[good] = round2(num(g[good]) + n);
  return { ok: true, qty: n, cost, unit, goods: { ...g }, city: cityName };
}

/** 卖货 */
export function sellGoods(world, actorId, { city, good, qty }) {
  const g = ensureGoods(world);
  if (!COMMODITIES[good]) return { ok: false, error: '没有这种货' };
  const have = num(g[good]);
  if (have < 1) return { ok: false, error: `手里没有${COMMODITIES[good].name}` };
  const cityName = city && world.cities?.[city] ? city : Object.keys(world.cities || {})[0];
  if (!cityName) return { ok: false, error: '没有这座城' };
  const n = Math.min(Math.round(num(qty)) || have, have);
  const unit = goodPrice(world, cityName, good);
  const gain = round2(n * unit);
  g[good] = round2(have - n);
  world.assets.silver = round2(num(world.assets.silver) + gain);
  return { ok: true, qty: n, gain, unit, goods: { ...g }, city: cityName };
}

/** 给负载用：手里的货 + 各城行市 */
export function goodsSnapshot(world) {
  const g = ensureGoods(world);
  const cityName = Object.keys(world.cities || {})[0];
  const prices = {};
  for (const k of GOODS) prices[k] = { name: COMMODITIES[k].name, price: goodPrice(world, cityName, k) };
  return { stock: { ...g }, prices, city: cityName };
}
