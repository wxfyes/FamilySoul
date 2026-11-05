import io
# ① /api/me 带一份价目（服务端唯一出处）
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        goods: goodsSnapshot(world),"
new = """        goods: goodsSnapshot(world),
        prices: (() => {
          try {
            const out = {};
            for (const k of ['weapon', 'armor', 'horse', 'siege', 'inn_room', 'inn_bed', 'meal', 'wine', 'wage_day', 'servant_month', 'shop', 'mansion']) {
              out[k] = priceOf(k);
            }
            const c0 = Object.keys(world.cities || {})[0];
            out.grain = grainPrice(world, c0);
            return out;
          } catch { return {}; }
        })(),"""
if old in s and 'prices: (() => {' not in s:
    s = s.replace(old, new, 1)
    if 'priceOf' not in s.split('\n')[30]:
        s = s.replace("import { grainPrice } from './world/prices.js';",
                      "import { grainPrice } from './world/prices.js';\nimport { priceOf } from './world/pricing.js';")
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① /api/me 带价目')
