import io
# 迁移：清洗"把玩家私宅当自己家"的旧数据（一次性）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'repairTrespassHomes' not in s:
    s = s.replace("import { ensureClans } from './clans.js';",
                  "import { ensureClans } from './clans.js';\nimport { repairTrespassHomes } from './dwelling.js';")
    anchor = "  // 一次性重判 v3"
    add = """  // 一次性：把"把别人私宅当自己家"的旧数据纠正回自家（如过门人占了玩家小院）
  try {
    world.flags = world.flags || {};
    if (!world.flags.trespassHomesRepaired) {
      const evs = [];
      const fixed = repairTrespassHomes(world, evs, (w, e) => ({ ...e, at: Date.now(), day: w.clock?.day || 1 }));
      world.flags.trespassHomesRepaired = { day: world.clock?.day || 1, fixed: fixed.length };
      if (fixed.length) console.log(`[Dwelling] 纠正 ${fixed.length} 个错占私宅的住处`);
    }
  } catch { /* 忽略 */ }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('迁移：纠正错占私宅')
