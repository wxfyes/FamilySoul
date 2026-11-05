import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'export function upgradeResidence' not in s:
    s = s.replace("export function relinkResidence(world, rootId) {", """/**
 * 把旧存档的院子升到当前模板：补缺的房间、补 depth/access、按模板改名。
 * 只补不删，幂等。
 */
export function upgradeResidence(world, rootId) {
  const root = world?.places?.[rootId];
  if (!root?.rooms) return 0;
  const grade = num(root.grade) || residenceGrade(root.name, 0);
  const spec = LAYOUTS[grade] || LAYOUTS[3];
  const segs = String(root.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
  const houseName = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '宅');
  let changed = 0;
  for (const room of spec) {
    const existing = root.rooms[room.key];
    const pid = existing?.id || `${rootId}__${room.key}`;
    let rp = world.places?.[pid];
    if (!rp) {
      rp = {
        id: pid, name: `${houseName}·${room.name}`, residence: true, use: room.use,
        parent: rootId, owner: root.owner || null, exits: [rootId], dynamic: true,
      };
      world.places[pid] = rp;
      changed += 1;
    }
    if (room.depth && rp.depth !== room.depth) { rp.depth = room.depth; changed += 1; }
    if (room.access && rp.access !== room.access) { rp.access = room.access; changed += 1; }
    const want = `${houseName}·${room.name}`;
    if (rp.name !== want) { rp.name = want; changed += 1; }
    root.rooms[room.key] = { id: pid, name: room.name, use: room.use, depth: room.depth || null, access: room.access || null };
  }
  if (grade >= 3 && (root.depth !== 4 || root.access !== 'family_core')) {
    root.depth = 4; root.access = 'family_core'; changed += 1;
  }
  relinkResidence(world, rootId);
  return changed;
}

export function relinkResidence(world, rootId) {""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加 upgradeResidence')

p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { buildAllResidences, relinkResidence, settleItinerants, buildPremises, buildCourts } from './residence.js';",
              "import { buildAllResidences, relinkResidence, upgradeResidence, settleItinerants, buildPremises, buildCourts } from './residence.js';")
t = t.replace("      if (p && p.rooms) relinkResidence(world, pid);",
              "      if (p && p.rooms) { upgradeResidence(world, pid); relinkResidence(world, pid); }")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('读档时升级旧院子')
