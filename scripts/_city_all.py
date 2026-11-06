import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { ensureCityBase, streetOfCity } from './city.js';",
              "import { ensureCityBase, ensureAllCityBases, streetOfCity } from './city.js';", 1)
old = """      // 城市基底：有人在外城，就先把那座城铺出来（幽州试点）"""
new = """      // 城市基底：先把所有城铺一遍（幂等，只做一次），外城才有人可打交道
      try {
        if (!world.flags?.cityBaseAllV1) {
          const n = ensureAllCityBases(world);
          world.flags = world.flags || {};
          world.flags.cityBaseAllV1 = { at: Date.now(), cities: n };
          console.log(`[City] 全城基底已铺：${n} 座城`);
        }
      } catch { /* 忽略 */ }

      // 城市基底：有人在外城，就先把那座城铺出来（幽州试点）"""
if old in s and 'cityBaseAllV1' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('③ 全城基底')
