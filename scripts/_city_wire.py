import io
# ① 巡检时补城市基底（先只补有人/有邀请潜力的，避免一次性铺12城）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { evictOutsiders } from './privacy.js';",
              "import { evictOutsiders } from './privacy.js';\nimport { ensureCityBase, streetOfCity } from './city.js';", 1)
old = "      const evicted = evictOutsiders(world);"
new = """      // 城市基底：有人在外城，就先把那座城铺出来（幽州试点）
      try {
        const cityNeeded = new Set();
        for (const a of Object.values(world.actors || {})) {
          if (!a || a.dead) continue;
          const pn = String(world.places?.[a.location]?.name || '');
          const m = pn.match(/^([\\u4e00-\\u9fa5]{2,3}?)(府|州|县)/);
          if (m) cityNeeded.add(m[1] + m[2]);
        }
        for (const cn of cityNeeded) {
          if (!world.cities?.[cn]) continue;
          ensureCityBase(world, cn);
        }
      } catch { /* 忽略 */ }
      const evicted = evictOutsiders(world);"""
if old in s and '城市基底：有人在外城' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 巡检按需铺城')

# ② 去哪：说"幽州"能到幽州主街
p2 = 'src/world/places-target.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { materializeRoom } from './residence.js';",
              "import { materializeRoom } from './residence.js';\nimport { streetOfCity } from './city.js';", 1)
old2 = """  // 说的是"人"（去找王甯）：先落到他现在所在的地方，再由门禁决定能不能进"""
new2 = """  // 说的是"哪座城"：先到那座城的主街（跨城靠这个认）
  try {
    for (const cn of Object.keys(world?.cities || {})) {
      const base = cn.replace(/府$|县$|州$/g, '');
      if (!text.includes(base) && !text.includes(cn)) continue;
      const sid = streetOfCity(world, cn);
      if (sid) return sid;
    }
  } catch { /* 忽略 */ }

  // 说的是"人"（去找王甯）：先落到他现在所在的地方，再由门禁决定能不能进"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 跨城识别')
