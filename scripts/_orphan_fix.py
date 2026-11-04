import io
p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  if (Number(world.assets?.silver) < 0) { world.assets.silver = 0; fixed += 1; }"""
new = """  if (Number(world.assets?.silver) < 0) { world.assets.silver = 0; fixed += 1; }

  // 孤儿地点：没有出口就当街立着（不然人进去了出不来）
  for (const [id, pl] of Object.entries(world.places || {})) {
    if (!pl || !pl.name || id === 'street') continue;
    const ex = Array.isArray(pl.exits) ? pl.exits.filter((x) => world.places?.[x]) : [];
    if (ex.length) continue;
    const back = world.places.street ? 'street' : Object.keys(world.places).find((k) => k !== id);
    if (back) { pl.exits = [back]; fixed += 1; }
  }"""
if old in s and '孤儿地点' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('加孤儿地点兜底')
