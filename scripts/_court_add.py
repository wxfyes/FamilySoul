import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'const COURT' not in s:
    s = s.replace("/** 按名字判经营场所类型 */", """/** 官府衙署：也是定死的层级，不递归 */
const COURT = [
  { key: 'gate', name: '照壁牌楼', use: 'gate', depth: 1, access: 'public_outer' },
  { key: 'hall', name: '大堂公堂', use: 'hall', depth: 2, access: 'guest_main' },
  { key: 'office', name: '二堂签押', use: 'office', depth: 3, access: 'family_inner' },
  { key: 'inner', name: '内宅花厅', use: 'bedroom', depth: 4, access: 'family_private' },
  { key: 'jail', name: '大牢', use: 'jail', depth: 0, access: 'servant_utility' },
  { key: 'ground', name: '演武校场', use: 'yard', depth: 1, access: 'public_outer' },
];

/** 按名字判经营场所类型 */""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 加 COURT 模板')

s = io.open(p, encoding='utf-8-sig').read()
if 'export function buildCourts' not in s:
    s = s.rstrip() + '''

/**
 * 官府衙署层级（幂等）：照壁牌楼、大堂、二堂签押、内宅花厅、大牢、校场。
 */
export function buildCourts(world) {
  let built = 0;
  const places = world?.places || {};
  if (Object.keys(places).length > 4000) return 0;
  for (const [pid, p] of Object.entries(places)) {
    if (!p || p.parent || String(pid).includes('__')) continue;
    if (!/衙|县衙|府衙|公堂/.test(String(p.name || ''))) continue;
    if (p.rooms && Object.keys(p.rooms).length) continue;
    p.rooms = p.rooms || {};
    p.exits = Array.isArray(p.exits) ? p.exits : ['street'];
    const segs = String(p.name || '衙').split('·').map((x) => x.trim()).filter(Boolean);
    const base = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '衙');
    for (const room of COURT) {
      const rid = `${pid}__${room.key}`;
      if (!places[rid]) {
        places[rid] = {
          id: rid, name: `${base}·${room.name}`, parent: pid, use: room.use,
          depth: room.depth, access: room.access, exits: [pid], dynamic: true, owner: p.owner || null,
        };
      }
      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, depth: room.depth, access: room.access };
      if (!p.exits.includes(rid)) p.exits.push(rid);
      built += 1;
    }
  }
  return built;
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('② 加 buildCourts')
