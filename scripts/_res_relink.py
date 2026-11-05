import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 早退之前也把门路连通、房名纠正
old = """  // 已有院子：等第不够就补建缺的那几间，不重建
  if (hasLayout(root) && num(root.grade) >= grade) {
    return { built: false, rooms: Object.keys(root.rooms).length, grade: num(root.grade) };
  }"""
new = """  // 宅名：取"临江·王宅"这一层
  const segs0 = String(root.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
  const houseName = segs0.length >= 3 ? `${segs0[0]}·${segs0[1]}` : (segs0.length === 2 ? `${segs0[0]}·${segs0[1]}` : (segs0[0] || '宅'));

  const relink = () => {
    root.exits = Array.isArray(root.exits) ? root.exits : [];
    for (const r of Object.values(root.rooms || {})) {
      const rp = world.places?.[r.id];
      if (!rp) continue;
      if (!rp.exits || !rp.exits.includes(rootId)) rp.exits = [rootId];
      if (!root.exits.includes(r.id)) root.exits.push(r.id);
      const want = `${houseName}·${r.name}`;
      if (rp.name !== want) rp.name = want;
    }
  };

  // 已有院子：等第够就只把门路与房名理顺
  if (hasLayout(root) && num(root.grade) >= grade) {
    relink();
    return { built: false, rooms: Object.keys(root.rooms).length, grade: num(root.grade) };
  }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 早退前也连门路+正名')

# ② 建完也用同一个 relink（替换原来的手写循环）
old2 = """  // 宅名取"临江·王宅"这一层，不要取到最后那间房名
  const segs = String(root.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
  const baseName = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '宅');"""
new2 = """  const baseName = houseName;"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 建时也用同一宅名')

old3 = """  // 各院都通宅门，宅门也通各院（不然人走不进去）
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  for (const r of Object.values(root.rooms)) {
    const p = world.places[r.id];
    if (!p) continue;
    if (!p.exits || !p.exits.includes(rootId)) p.exits = [rootId];
    if (!root.exits.includes(r.id)) root.exits.push(r.id);
  }"""
new3 = """  relink();"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 建完统一 relink')
io.open(p, 'w', encoding='utf-8-sig').write(s)
