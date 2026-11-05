import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function relinkResidence' not in s:
    s = s.replace("export function linkRooms(world, rootId) {", """/**
 * 只把门路与房名理顺（不建东西，每次读档都能跑，很便宜）
 */
export function relinkResidence(world, rootId) {
  const root = world?.places?.[rootId];
  if (!root?.rooms) return 0;
  const segs0 = String(root.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
  const houseName = segs0.length >= 2 ? `${segs0[0]}·${segs0[1]}` : (segs0[0] || '宅');
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  let linked = 0;
  for (const r of Object.values(root.rooms)) {
    const rp = world.places?.[r.id];
    if (!rp) continue;
    if (!rp.exits || !rp.exits.includes(rootId)) rp.exits = [rootId];
    if (!root.exits.includes(r.id)) { root.exits.push(r.id); linked += 1; }
    const want = `${houseName}·${r.name}`;
    if (rp.name !== want) rp.name = want;
  }
  return linked;
}

export function linkRooms(world, rootId) {""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加 relinkResidence')

p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { buildAllResidences } from './residence.js';",
              "import { buildAllResidences, relinkResidence } from './residence.js';")
anchor = "  // 宅院巡检：同一个世界日只跑一次"
add = """  // 每次读档：把已有宅子的门路与房名理顺（不建东西，很便宜）
  try {
    for (const pid of Object.keys(world.places || {})) {
      const p = world.places[pid];
      if (p && p.rooms) relinkResidence(world, pid);
    }
  } catch { /* 忽略 */ }

""" + anchor
if '把已有宅子的门路与房名理顺' not in t:
    t = t.replace(anchor, add, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('每次读档连门路')
