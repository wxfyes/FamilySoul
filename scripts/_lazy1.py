import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

# ============ ① ensureResidence：只写元数据，不建地点 ============
old = """  let built = 0;
  for (const room of spec) {
    const pid = `${rootId}__${room.key}`;
    if (root.rooms[room.key] && world.places[root.rooms[room.key].id]) continue;
    if (world.places[pid]) { root.rooms[room.key] = { id: pid, name: room.name, use: room.use }; continue; }
    world.places[pid] = {
      id: pid,
      name: `${baseName}·${room.name}`,
      residence: true,
      use: room.use,
      parent: rootId,
      owner: root.owner || ownerId || null,
      exits: [rootId],
      depth: room.depth || null,
      access: room.access || null,
      floor: room.floor || null,
      dynamic: true,
    };
    root.rooms[room.key] = { id: pid, name: room.name, use: room.use, depth: room.depth || null, access: room.access || null };
    built += 1;
  }

  // 宅门通街，街也通宅门
  const street = world.places.street;
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  if (street) {
    if (!root.exits.includes('street')) root.exits.push('street');
    street.exits = Array.isArray(street.exits) ? street.exits : [];
    if (!street.exits.includes(rootId)) street.exits.push(rootId);
  }
  relink();

  return { built: built > 0, rooms: Object.keys(root.rooms).length, grade };"""
new = """  // 只写"账"（这宅子有几间什么院），不写"地点"——地点等人真走进去时再展开
  let built = 0;
  for (const room of spec) {
    const pid = `${rootId}__${room.key}`;
    if (!root.rooms[room.key]) built += 1;
    root.rooms[room.key] = {
      id: pid, name: room.name, use: room.use,
      depth: room.depth || null, access: room.access || null, floor: room.floor || null,
    };
  }

  // 宅门通街，街也通宅门（只连宅门，不连房间）
  const street = world.places.street;
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  if (street) {
    if (!root.exits.includes('street')) root.exits.push('street');
    street.exits = Array.isArray(street.exits) ? street.exits : [];
    if (!street.exits.includes(rootId)) street.exits.push(rootId);
  }

  return { built: built > 0, rooms: Object.keys(root.rooms).length, grade };"""
if old in s:
    s = s.replace(old, new, 1)
    print('① ensureResidence 改为只记账')
io.open(p, 'w', encoding='utf-8-sig').write(s)
