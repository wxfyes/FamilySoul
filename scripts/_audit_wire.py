import io
# 时钟日翻篇时对账一次；并记下当日开盘银子
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { advanceWorldTick } from './tick.js';",
              "import { advanceWorldTick } from './tick.js';\nimport { reconcileMoney } from './ledger.js';", 1)
old = """    world.clock.hour = 0;
    world.clock.day += 1;"""
new = """    world.clock.hour = 0;
    // 换日之前先对一次账：昨日开盘 + 昨日流水 应等于今日银子
    try { reconcileMoney(world, Number(world.clock?.day) || 1); } catch { /* 忽略 */ }
    world.clock.day += 1;
    try { world.flags = world.flags || {}; world.flags.dayOpenSilver = Math.round((Number(world.assets?.silver) || 0) * 100) / 100; } catch { /* 忽略 */ }"""
if old in s and '换日之前先对一次账' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 日翻篇对账')
