import io
# 迁移里补夫妻关系（一次性）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'linkCouples' not in s:
    s = s.replace("import { repairTrespassHomes } from './dwelling.js';",
                  "import { repairTrespassHomes } from './dwelling.js';\nimport { linkCouples } from './couples.js';")
    anchor = "  // 一次性：把\"把别人私宅当自己家\"的旧数据纠正回自家（如过门人占了玩家小院）"
    add = """  // 一次性：从角色描述与同住关系补出夫妻（spouse 成唯一事实源）
  try {
    world.flags = world.flags || {};
    if (!world.flags.couplesLinked) {
      const pairs = linkCouples(world);
      world.flags.couplesLinked = { day: world.clock?.day || 1, pairs: pairs.length };
      if (pairs.length) console.log(`[Couple] 结成夫妻 ${pairs.length} 对：${pairs.map((x) => x.join('—')).join('、')}`);
    }
  } catch { /* 忽略 */ }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('迁移：补夫妻关系')
