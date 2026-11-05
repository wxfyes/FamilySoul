import io
p = 'src/world/dwelling.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { getPlaceDisplayName } from './names.js';", "import { getPlaceDisplayName } from './naming.js';")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('导入改为 naming.js')

# clock：每小时巡检私宅
p2 = 'src/world/clock.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'evictTrespassers' not in t:
    t = t.replace("import { runMigration, settleMigrants } from './migration.js';",
                  "import { runMigration, settleMigrants } from './migration.js';\nimport { evictTrespassers } from './dwelling.js';")
    old = """function advanceHour(world, events, nowMs) {
  world.clock.hour += 1;"""
    new = """function advanceHour(world, events, nowMs) {
  world.clock.hour += 1;
  // 每小时：私宅巡检——不是这宅子的人，待久了或入夜就请出去
  try {
    evictTrespassers(world, events, nextEvent);
  } catch (err) {
    console.warn('[Dwelling] 私宅巡检失败：', err.message);
  }"""
    if old in t:
        t = t.replace(old, new, 1)
        print('① 时钟接入私宅巡检')
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
