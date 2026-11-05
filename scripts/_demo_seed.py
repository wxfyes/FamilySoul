import io
p = 'src/world/demography.js'
s = io.open(p, encoding='utf-8-sig').read()
# 在文件末尾补：初始播种函数
if 'export function seedUnmarriedPool' not in s:
    s = s.rstrip() + '''

/** 初始播种：开局市井就该有可遇见的未婚姑娘（一次性） */
export function seedUnmarriedPool(world, target = 12) {
  const pool = Object.values(world.actors || {}).filter(
    (a) => a && !a.dead && a.gender === 'female' && a.age >= 16 && a.age <= 28 && (!a.marital || a.marital === 'single'),
  );
  const need = Math.max(0, target - pool.length);
  if (!need) return [];
  return addUnmarried(world, need, null, null);
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 加初始播种')

# 迁移里一次性播种
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'seedUnmarriedPool' not in t:
    t = t.replace("import { ensureClans } from './clans.js';",
                  "import { ensureClans } from './clans.js';\nimport { seedUnmarriedPool } from './demography.js';")
    anchor = "  // 一次性重判 v3"
    add = """  // 一次性：开局市井要有可遇见的未婚女子（之后由每月补人维持）
  try {
    world.flags = world.flags || {};
    if (!world.flags.unmarriedSeeded) {
      const added = seedUnmarriedPool(world, 12);
      world.flags.unmarriedSeeded = { day: world.clock?.day || 1, added: added.length };
      if (added.length) console.log(`[Demo] 开局补入未婚女子 ${added.length} 人：${added.join('、')}`);
    }
  } catch { /* 忽略 */ }

""" + anchor
    if anchor in t:
        t = t.replace(anchor, add, 1)
        io.open(p2, 'w', encoding='utf-8-sig').write(t)
        print('② 迁移初次播种')
