import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'couplesLinkedV2' not in s:
    anchor = "  // 一次性：把\"把别人私宅当自己家\"的旧数据纠正回自家（如过门人占了玩家小院）"
    add = """  // 一次性 v2：修悬空配偶（指向已不存在的人），再重新结对
  try {
    world.flags = world.flags || {};
    if (!world.flags.couplesLinkedV2) {
      const pairs = linkCouples(world);
      world.flags.couplesLinkedV2 = { day: world.clock?.day || 1, pairs: pairs.length };
      if (pairs.length) console.log(`[Couple] 重修夫妻 ${pairs.length} 对`);
    }
  } catch { /* 忽略 */ }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('加 couplesLinkedV2')
