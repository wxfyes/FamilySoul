import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { ensureCityBase, ensureAllCityBases, streetOfCity } from './city.js';",
              "import { ensureCityBase, ensureAllCityBases, streetOfCity } from './city.js';", 1)
old = """      // 城市基底：先把所有城铺一遍（幂等，只做一次），外城才有人可打交道"""
new = """      // 一次性：只保留大城的基底，把早先铺过头的小城清掉（省地点与人口）
      try {
        if (!world.flags?.cityTrimV1) {
          const cities = Object.entries(world.cities || {})
            .sort((a, b) => (Number(b[1]?.wealth) || 0) - (Number(a[1]?.wealth) || 0))
            .map(([k]) => k);
          const keep = new Set(['临江府', ...cities.slice(0, 12)]);
          let removedP = 0;
          let removedA = 0;
          for (const cn of Object.keys(world.flags?.cityBase || {})) {
            if (keep.has(cn)) continue;
            const slug = cn.replace(/府$|县$|州$/g, '');
            for (const [pid, pl] of Object.entries(world.places || {})) {
              if (!String(pid).startsWith(`${slug}_`)) continue;
              delete world.places[pid];
              removedP += 1;
            }
            for (const [aid, a] of Object.entries(world.actors || {})) {
              if (!a) continue;
              if (String(a.id).startsWith(`${slug}_`) || (world.places?.[a.home]?.name || '').startsWith(`${cn}·`)) {
                delete world.actors[aid];
                removedA += 1;
              }
            }
            delete world.flags.cityBase[cn];
          }
          world.flags.cityTrimV1 = { at: Date.now(), removedP, removedA };
          console.log(`[City] 清理小城基底：地点 -${removedP}，人口 -${removedA}`);
        }
      } catch { /* 忽略 */ }

      // 城市基底：先把大城铺一遍（幂等，只做一次），外城才有人可打交道"""
if old in s and 'cityTrimV1' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加清理迁移')
