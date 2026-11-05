import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

# ============ ② 新增：按需展开房间 + 老数据收拢 ============
if 'export function materializeRoom' not in s:
    s = s.replace("export function buildAllResidences(world) {", """/**
 * 按需把一间院子展开成真实地点（只在这里创建 place）
 * @returns {string|null} 房间的 placeId
 */
export function materializeRoom(world, parentId, key) {
  const root = world?.places?.[parentId];
  const rec = root?.rooms?.[key];
  if (!root || !rec) return null;
  const id = rec.id || `${parentId}__${key}`;
  let p = world.places[id];
  if (!p) {
    const segs = String(root.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
    const houseName = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '宅');
    world.places[id] = {
      id,
      name: `${houseName}·${rec.name}`,
      residence: true,
      use: rec.use || null,
      parent: parentId,
      owner: root.owner || null,
      exits: [parentId],
      depth: rec.depth || null,
      access: rec.access || null,
      floor: rec.floor || null,
      dynamic: true,
    };
    p = world.places[id];
  }
  // 双向门路
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  if (!root.exits.includes(id)) root.exits.push(id);
  if (!p.exits || !p.exits.includes(parentId)) p.exits = [parentId];
  return id;
}

/** 老存档：把已经建成"独立地点"的房间收回到父地点的账里（只留人待着的那几间） */
export function collapseRoomPlaces(world) {
  let removed = 0;
  const occupied = new Set(Object.values(world.actors || {}).map((a) => a && a.location).filter(Boolean));
  for (const [pid, p] of Object.entries(world?.places || {})) {
    if (!p || !p.parent) continue;
    const parent = world.places[p.parent];
    if (!parent) { delete world.places[pid]; removed += 1; continue; }
    parent.rooms = parent.rooms || {};
    const key = String(pid).split('__').pop();
    if (!parent.rooms[key]) {
      parent.rooms[key] = { id: pid, name: String(p.name || '').split('·').pop(), use: p.use || null, depth: p.depth || null, access: p.access || null, floor: p.floor || null };
    }
    // 有人待着的房间先留着，等他自己走开再收
    if (occupied.has(pid)) continue;
    parent.exits = (parent.exits || []).filter((x) => x !== pid);
    delete world.places[pid];
    removed += 1;
  }
  return removed;
}

export function buildAllResidences(world) {""", 1)
    print('② 加 materializeRoom / collapseRoomPlaces')
io.open(p, 'w', encoding='utf-8-sig').write(s)
