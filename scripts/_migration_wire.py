import io

# ① 时钟：人口流动取代配额补人
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { runDemography } from './demography.js';", "import { runMigration } from './migration.js';")
old = """  // 每月：人口补充（年轻未婚的人太少，市井自然补进几个）
  try {
    runDemography(world, nextEvent, events);
  } catch (err) {
    console.warn('[Demo] 人口补充失败：', err.message);
  }"""
new = """  // 每月：人口流动（灾荒逃难、招工投奔、商旅往来、投亲嫁娶——由事出人，不按配额）
  try {
    runMigration(world, nextEvent, events);
  } catch (err) {
    console.warn('[Migrate] 人口流动失败：', err.message);
  }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 时钟改人口流动')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② 删掉配额补人的一次性播种/补足（既有人留着，但不再按配额往池里填）
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { seedUnmarriedPool } from './demography.js';\n", "")
block_seed = """  // 一次性：开局市井要有可遇见的未婚女子（之后由每月补人维持）
  try {
    world.flags = world.flags || {};
    if (!world.flags.unmarriedSeeded) {
      const added = seedUnmarriedPool(world, 12);
      world.flags.unmarriedSeeded = { day: world.clock?.day || 1, added: added.length };
      if (added.length) console.log(`[Demo] 开局补入未婚女子 ${added.length} 人：${added.join('、')}`);
    }
  } catch { /* 忽略 */ }

"""
block_top = """  // 一次性补足：上次只播到 12，这次补到 14
  try {
    world.flags = world.flags || {};
    if (!world.flags.unmarriedTopUpV2) {
      const added = seedUnmarriedPool(world, 14);
      world.flags.unmarriedTopUpV2 = { day: world.clock?.day || 1, added: added.length };
      if (added.length) console.log(`[Demo] 补足未婚女子 ${added.length} 人`);
    }
  } catch { /* 忽略 */ }

"""
for blk in (block_seed, block_top):
    if blk in t:
        t = t.replace(blk, "", 1)
        print('② 删掉一段配额播种')
io.open(p2, 'w', encoding='utf-8-sig').write(t)

# ③ demography.js 里的配额补人逻辑删掉，只保留说明（避免两套并存）
p3 = 'src/world/demography.js'
d = io.open(p3, encoding='utf-8-sig').read()
if 'runMigration' not in d:
    d = "/**\n * 已废弃：人口不再按配额补，改由 migration.js 按事出人。\n * 保留此文件只为兼容旧 import；请勿再从这里补人。\n */\n\nexport function runDemography() { return []; }\nexport function addUnmarried() { return []; }\nexport function seedUnmarriedPool() { return []; }\n"
    io.open(p3, 'w', encoding='utf-8-sig').write(d)
    print('③ 废弃配额补人模块')
