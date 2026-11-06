import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { advanceWorldTick } from './world/tick.js';",
              "import { advanceWorldTick } from './world/tick.js';\nimport { ensureCityBase, streetOfCity } from './world/city.js';", 1)
old = """        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进"""
new = """        // 说的是哪座城：先到那座城的主街（没有基底就现铺一座）
        try {
          for (const cn of Object.keys(world.cities || {})) {
            const base = cn.replace(/府$|县$|州$/g, '');
            if (!target.includes(base) && !target.includes(cn)) continue;
            let sid = streetOfCity(world, cn);
            if (!sid) { ensureCityBase(world, cn); sid = streetOfCity(world, cn); }
            if (sid) { target = sid; break; }
          }
        } catch { /* 忽略 */ }

        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进"""
if old in s and '先到那座城的主街' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('go 里按城识路')
