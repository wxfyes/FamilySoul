/**
 * 物价：天下熙熙皆为利来。
 *
 * 只维护"指数"，不维护每一笔买卖：
 *   world.market[商品] = { base: 常价, index: 现在的倍数 }
 *   某城的实际价 = 常价 × 指数 × 城的景气
 *
 * 谁在动指数：
 *   灾荒 → 粮涨
 *   打仗 → 粮铁涨
 *   秋收 → 粮落
 *   冬天 → 粮涨（封河运不进）
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const COMMODITIES = {
  grain: { name: '粮', base: 0.6 },
  tea: { name: '茶', base: 1.2 },
  silk: { name: '丝', base: 3.0 },
  salt: { name: '盐', base: 0.8 },
  iron: { name: '铁', base: 1.5 },
  herb: { name: '药材', base: 0.9 },
};

export function ensureMarket(world) {
  world.market = world.market && typeof world.market === 'object' ? world.market : {};
  for (const [k, def] of Object.entries(COMMODITIES)) {
    const m = world.market[k];
    if (!m || typeof m !== 'object') world.market[k] = { base: def.base, index: 1 };
    else {
      if (!(num(m.base) > 0)) m.base = def.base;
      if (!(num(m.index) > 0)) m.index = 1;
    }
  }
  return world.market;
}

/** 每日：指数向 1 回归，再叠加季节 */
export function driftMarket(world) {
  ensureMarket(world);
  const season = String(world.clock?.season || 'spring');
  for (const [k, m] of Object.entries(world.market)) {
    let idx = num(m.index) || 1;
    idx += (1 - idx) * 0.08;                       // 自然回归
    if (season === 'winter' && (k === 'grain' || k === 'salt')) idx *= 1.02;
    if (season === 'autumn' && k === 'grain') idx *= 0.98;
    m.index = Math.round(Math.max(0.4, Math.min(4, idx)) * 1000) / 1000;
  }
}

/** 事件冲击：灾荒/战事/丰收 */
export function bumpMarket(world, shocks) {
  ensureMarket(world);
  for (const [k, mult] of Object.entries(shocks || {})) {
    if (!world.market[k]) continue;
    world.market[k].index = Math.round(Math.max(0.4, Math.min(4, num(world.market[k].index) * mult)) * 1000) / 1000;
  }
}

/** 某城某物的市价 */
export function priceAt(world, cityName, key) {
  ensureMarket(world);
  const m = world.market[key] || { base: 1, index: 1 };
  const ct = world.cities?.[cityName];
  const cityFactor = ct ? Math.max(0.7, Math.min(1.6, (num(ct.price) || 100) / 100)) : 1;
  return Math.round(num(m.base) * num(m.index) * cityFactor * 100) / 100;
}

/** 粮价（军粮、赈灾都用它） */
export function grainPrice(world, cityName) {
  return Math.max(0.2, priceAt(world, cityName, 'grain'));
}

/** 给世界负载用：今日物价 */
export function marketSnapshot(world) {
  ensureMarket(world);
  return Object.entries(world.market).map(([k, m]) => ({
    key: k,
    name: COMMODITIES[k]?.name || k,
    price: Math.round(num(m.base) * num(m.index) * 100) / 100,
    index: Math.round(num(m.index) * 1000) / 1000,
  }));
}
