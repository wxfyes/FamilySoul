import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            const c0 = Object.keys(world.cities || {})[0];
            out.grain = grainPrice(world, c0);"""
new = """            const c0 = Object.keys(world.cities || {})[0];
            out.grain = grainPrice(world, c0);
            // 招募安家银也从兵制表里取，App 不再写死
            out.guard_gift = RECRUIT_KINDS.guard.cost;
            out.retainer_gift = RECRUIT_KINDS.retainer.cost;"""
if old in s and 'guard_gift' not in s:
    s = s.replace(old, new, 1)
    if 'RECRUIT_KINDS' not in s.split('\n')[40]:
        s = s.replace("import { quellBandits, banditStrengthTotal } from './world/bandits.js';",
                      "import { quellBandits, banditStrengthTotal } from './world/bandits.js';\nimport { RECRUIT_KINDS } from './world/warfare.js';")
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 暴露招募安家银')
