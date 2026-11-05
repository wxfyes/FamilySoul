import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  // 各院都通宅门
  for (const r of Object.values(root.rooms)) {
    const p = world.places[r.id];
    if (p && (!p.exits || !p.exits.includes(rootId))) p.exits = [rootId];
  }"""
new = """  // 各院都通宅门，宅门也通各院（不然人走不进去）
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  for (const r of Object.values(root.rooms)) {
    const p = world.places[r.id];
    if (!p) continue;
    if (!p.exits || !p.exits.includes(rootId)) p.exits = [rootId];
    if (!root.exits.includes(r.id)) root.exits.push(r.id);
  }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('宅门与各院互通')
