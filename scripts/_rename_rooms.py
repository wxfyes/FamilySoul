import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

# 经营场所：已有同名 key 时也要改成模板名字
old = """      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, floor: room.floor };
      if (!p.exits.includes(rid)) p.exits.push(rid);"""
new = """      const rp = places[rid];
      if (rp) {
        const want = `${base}·${room.name}`;
        if (rp.name !== want) rp.name = want;
        rp.use = room.use;
        rp.floor = room.floor;
      }
      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, floor: room.floor };
      if (!p.exits.includes(rid)) p.exits.push(rid);"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 酒楼房间改名')

# 衙署：同样
old2 = """      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, depth: room.depth, access: room.access };
      if (!p.exits.includes(rid)) p.exits.push(rid);"""
new2 = """      const rp = places[rid];
      if (rp) {
        const want = `${base}·${room.name}`;
        if (rp.name !== want) rp.name = want;
        rp.use = room.use; rp.depth = room.depth; rp.access = room.access;
      }
      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, depth: room.depth, access: room.access };
      if (!p.exits.includes(rid)) p.exits.push(rid);"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 衙署房间改名')
io.open(p, 'w', encoding='utf-8-sig').write(s)
