import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 房间带上进深与开门权限
old = """      exits: [rootId],
      dynamic: true,
    };"""
new = """      exits: [rootId],
      depth: room.depth || null,
      access: room.access || null,
      floor: room.floor || null,
      dynamic: true,
    };"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 房间写入进深/权限')

old2 = """    root.rooms[room.key] = { id: pid, name: room.name, use: room.use };"""
new2 = """    root.rooms[room.key] = { id: pid, name: room.name, use: room.use, depth: room.depth || null, access: room.access || null };"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 账本记进深')

# ③ 宅子本身（正房）给 depth 4 / family_core
old3 = """  root.rooms = root.rooms || {};
  root.grade = grade;
  root.residence = true;"""
new3 = """  root.rooms = root.rooms || {};
  root.grade = grade;
  root.residence = true;
  if (grade >= 3) { root.depth = 4; root.access = 'family_core'; }"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 正房进深 4')

# ④ 经营场所（前店后坊 / 三层酒楼）
if 'export function buildPremises' not in s:
    s = s.rstrip() + '''

/**
 * 经营场所的立体空间（幂等）：三层酒楼、前店后坊、茶坊雅间。
 * 与宅院同一套规矩：定死模板、双向开门、只建一次。
 */
export function buildPremises(world) {
  let built = 0;
  const places = world?.places || {};
  if (Object.keys(places).length > 4000) return 0;
  for (const [pid, p] of Object.entries(places)) {
    if (!p || p.parent || String(pid).includes('__')) continue;
    if (p.rooms && Object.keys(p.rooms).length) continue;
    const kind = premisesKind(p.name);
    if (!kind) continue;
    // 只给"有主/有掌柜"的铺子建，野摊不建
    const owned = p.owner || p.keeper || (world.assets?.properties || []).some((x) => x && (x.place === pid || (x.name && String(p.name || '').includes(String(x.name).split('（')[0]))));
    if (!owned) continue;

    const spec = PREMISES[kind];
    p.rooms = p.rooms || {};
    p.exits = Array.isArray(p.exits) ? p.exits : ['street'];
    const segs = String(p.name || '铺').split('·').map((x) => x.trim()).filter(Boolean);
    const base = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '铺');
    for (const room of spec) {
      const rid = `${pid}__${room.key}`;
      if (!places[rid]) {
        places[rid] = {
          id: rid, name: `${base}·${room.name}`, parent: pid,
          floor: room.floor, use: room.use, exits: [pid], dynamic: true, owner: p.owner || null,
        };
      }
      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, floor: room.floor };
      if (!p.exits.includes(rid)) p.exits.push(rid);
      built += 1;
    }
  }
  return built;
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('④ 加 buildPremises')
else:
    io.open(p, 'w', encoding='utf-8-sig').write(s)
