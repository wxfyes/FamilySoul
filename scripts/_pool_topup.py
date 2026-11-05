import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "  // 一次性重判 v3"
add = """  // 一次性补足：上次只播到 12，这次补到 14
  try {
    world.flags = world.flags || {};
    if (!world.flags.unmarriedTopUpV2) {
      const added = seedUnmarriedPool(world, 14);
      world.flags.unmarriedTopUpV2 = { day: world.clock?.day || 1, added: added.length };
      if (added.length) console.log(`[Demo] 补足未婚女子 ${added.length} 人`);
    }
  } catch { /* 忽略 */ }

""" + anchor
if 'unmarriedTopUpV2' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('补足未婚池')
