import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function linkRooms' not in s:
    s = s.replace("/**\n * 巡检全世界的宅子", """/**
 * 宅门与各院互通（幂等）：老存档的宅子里已建了房间，但门路没连上，走不进去。
 */
export function linkRooms(world, rootId) {
  const root = world?.places?.[rootId];
  if (!root?.rooms) return 0;
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  let linked = 0;
  for (const r of Object.values(root.rooms)) {
    const p = world.places?.[r.id];
    if (!p) continue;
    if (!p.exits || !p.exits.includes(rootId)) p.exits = [rootId];
    if (!root.exits.includes(r.id)) { root.exits.push(r.id); linked += 1; }
  }
  return linked;
}

/**
 * 巡检全世界的宅子""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加 linkRooms')

p2 = 'src/world/residence.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("    if (before && r.rooms > before) upgraded += 1;\n    assignStaffQuarters(world, pid);",
              "    if (before && r.rooms > before) upgraded += 1;\n    linkRooms(world, pid);\n    assignStaffQuarters(world, pid);")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('巡检里连门路')
