import io

# ============ ② 房价地价按城分级 ============
p = 'src/world/pricing.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function cityFactor' not in s:
    s = s.rstrip() + '''

/**
 * 城的等级：由富庶与物价定（临江府这种大埠，地价自然比小县贵）
 * 0.6 ~ 2.6 倍
 */
export function cityFactor(world, cityName) {
  const ct = world?.cities?.[cityName];
  if (!ct) return 1;
  const wealth = Number(ct.wealth) || 30;
  const price = Number(ct.price) || 100;
  const f = (wealth / 50) * (price / 100);
  return Math.round(Math.max(0.6, Math.min(2.6, f)) * 100) / 100;
}

/** 某城的房价/地价（key = shop 或 mansion） */
export function propertyPriceAt(world, cityName, key) {
  const base = priceOf(key);
  return Math.round(base * cityFactor(world, cityName) * 100) / 100;
}

/** 某城的房钱（住店按城价） */
export function roomPriceAt(world, cityName) {
  const base = priceOf('inn_room');
  return Math.round(base * cityFactor(world, cityName) * 100) / 100;
}
'''
    print('① 城市因子与分级房价')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# 客栈按城价：server 开房分支用城价覆盖
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'roomPriceAt' not in t:
    t = t.replace("import { marketSnapshot } from './world/prices.js';",
                  "import { marketSnapshot } from './world/prices.js';\nimport { roomPriceAt, propertyPriceAt } from './world/pricing.js';")
    # 开房时：按所在城重定价（若天道报的价与城价差太多，以城价为准）
    old = """        if (pend.kind === 'lodging') {
          const innId = pend.inn || 'inn';"""
    new = """        if (pend.kind === 'lodging') {
          const innId = pend.inn || 'inn';
          // 住店价按城分级（临江府贵、小县便宜）
          const cityOfInn = world.cities?.临江府 ? '临江府' : Object.keys(world.cities || {})[0];
          const fair = roomPriceAt(world, cityOfInn);
          if (fair > 0) {
            // 差价退补：天道报贵了就退，报便宜了就按城价补
            const diff = Math.round((price - fair) * 100) / 100;
            if (Math.abs(diff) > 0.005) {
              if (diff > 0) world.assets.silver = Math.round((Number(world.assets.silver) + diff) * 100) / 100;
              else if (Number(world.assets.silver) >= -diff) world.assets.silver = Math.round((Number(world.assets.silver) + diff) * 100) / 100;
            }
          }"""
    if old in t:
        t = t.replace(old, new, 1)
        print('② 开房价按城分级')
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
