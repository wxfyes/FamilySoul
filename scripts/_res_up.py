import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① ensureResidence 支持"升级等第"：已有院子但等第不够，补建缺的
old = """  const root = world?.places?.[rootId];
  if (!root) return { built: false, rooms: 0, grade: 0 };
  if (hasLayout(root)) return { built: false, rooms: Object.keys(root.rooms).length, grade: num(root.grade) };

  const grade = num(root.grade) || residenceGrade(root.name, scale);"""
new = """  const root = world?.places?.[rootId];
  if (!root) return { built: false, rooms: 0, grade: 0 };

  const gradeWanted = residenceGrade(root.name, scale);
  const grade = Math.max(num(root.grade), gradeWanted) || 3;

  // 已有院子：等第不够就补建缺的那几间，不重建
  if (hasLayout(root) && num(root.grade) >= grade) {
    return { built: false, rooms: Object.keys(root.rooms).length, grade: num(root.grade) };
  }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 支持等第升级')

# ② 旧房间不清空：按 spec 补缺
old2 = """  root.rooms = root.rooms || {};
  root.grade = grade;
  root.residence = true;

  let built = 0;
  for (const room of spec) {
    const pid = `${rootId}__${room.key}`;
    if (world.places[pid]) continue;"""
new2 = """  root.rooms = root.rooms || {};
  root.grade = grade;
  root.residence = true;

  let built = 0;
  for (const room of spec) {
    const pid = `${rootId}__${room.key}`;
    if (root.rooms[room.key] && world.places[root.rooms[room.key].id]) continue;
    if (world.places[pid]) { root.rooms[room.key] = { id: pid, name: room.name, use: room.use }; continue; }"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 补建缺的房间')

# ③ 眷属也按位份安置（正妻→正房，二房→东厢，其余→西厢）
old3 = """  let placed = 0;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    if (a.home !== rootId && a.location !== rootId && a.location !== a.home) continue;
    const hit = STAFF_USE.find((s) => s.test.test(String(a.role || '')));"""
new3 = """  let placed = 0;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    if (a.home !== rootId && a.location !== rootId && a.location !== a.home) continue;

    // 眷属按位份住：正妻住正房，二房住东厢，其余住西厢
    if (a.household || a.spouse === 'husband') {
      const rank = /正妻|大娘子/.test(String(a.role || '')) ? 'main'
        : /二房|如夫人|侧室|妾/.test(String(a.role || '')) ? 'east' : 'west';
      const room = byUse[rank] || byUse.main;
      if (room && a.quarters !== room) { a.quarters = room; placed += 1; }
      continue;
    }

    const hit = STAFF_USE.find((s) => s.test.test(String(a.role || '')));"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 眷属按位份安置')
io.open(p, 'w', encoding='utf-8-sig').write(s)
