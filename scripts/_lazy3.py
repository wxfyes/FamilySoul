import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

# ③ upgradeResidence：只记账
old = """  let changed = 0;
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
  }"""
new = """  let changed = 0;
  for (const room of spec) {
    const existing = root.rooms[room.key];
    const pid = existing?.id || `${rootId}__${room.key}`;
    // 只改账；已经展开的地点顺手把名字与进深对齐
    const rp = world.places?.[pid];
    if (rp) {
      const want = `${houseName}·${room.name}`;
      if (rp.name !== want) { rp.name = want; changed += 1; }
      if (room.depth && rp.depth !== room.depth) { rp.depth = room.depth; changed += 1; }
      if (room.access && rp.access !== room.access) { rp.access = room.access; changed += 1; }
    }
    const wantRec = { id: pid, name: room.name, use: room.use, depth: room.depth || null, access: room.access || null };
    if (!existing || existing.name !== wantRec.name || existing.depth !== wantRec.depth) changed += 1;
    root.rooms[room.key] = wantRec;
  }"""
if old in s:
    s = s.replace(old, new, 1)
    print('③ upgradeResidence 只记账')

# ④ 经营场所 / 衙署：只记账（不再建地点）
old2 = """    for (const room of spec) {
      const rid = `${pid}__${room.key}`;
      if (!places[rid]) {
        places[rid] = {
          id: rid, name: `${base}·${room.name}`, parent: pid,
          floor: room.floor, use: room.use, exits: [pid], dynamic: true, owner: p.owner || null,
        };
        built += 1;
      }
      const rp = places[rid];
      if (rp) {
        const want = `${base}·${room.name}`;
        if (rp.name !== want) rp.name = want;
        rp.use = room.use;
        rp.floor = room.floor;
      }
      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, floor: room.floor };
      if (!p.exits.includes(rid)) p.exits.push(rid);
    }"""
new2 = """    for (const room of spec) {
      const rid = `${pid}__${room.key}`;
      if (!p.rooms[room.key]) built += 1;
      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, floor: room.floor, access: 'shop_floor' };
    }"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('④ 经营场所只记账')

old3 = """    for (const room of COURT) {
      const rid = `${pid}__${room.key}`;
      if (!places[rid]) {
        places[rid] = {
          id: rid, name: `${base}·${room.name}`, parent: pid, use: room.use,
          depth: room.depth, access: room.access, exits: [pid], dynamic: true, owner: p.owner || null,
        };
        built += 1;
      }
      const rp = places[rid];
      if (rp) {
        const want = `${base}·${room.name}`;
        if (rp.name !== want) rp.name = want;
        rp.use = room.use; rp.depth = room.depth; rp.access = room.access;
      }
      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, depth: room.depth, access: room.access };
      if (!p.exits.includes(rid)) p.exits.push(rid);
    }"""
new3 = """    for (const room of COURT) {
      const rid = `${pid}__${room.key}`;
      if (!p.rooms[room.key]) built += 1;
      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, depth: room.depth, access: room.access };
    }"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('⑤ 衙署只记账')
io.open(p, 'w', encoding='utf-8-sig').write(s)
