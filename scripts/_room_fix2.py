import io
# ① roomForHour：quarters / 目标房间没展开就先展开
p = 'src/world/room-life.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const slot = routine.filter((s) => num(s.at) <= num(hour)).pop() || routine[0];
  let pid = slot.place;"""
new = """  const slot = routine.filter((s) => num(s.at) <= num(hour)).pop() || routine[0];
  let pid = slot.place;
  // 目标还是"账上的院子"（没展开）→ 先展开
  if (pid && !world.places?.[pid] && String(pid).includes('__')) {
    const [parentId, key] = String(pid).split('__');
    pid = materializeRoom(world, parentId, key) || parentId;
  }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① roomForHour 先展开目标房间')

# ② 巡检里给每座宅子的住户补 quarters（原来只在建房时做）
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'assignStaffQuarters' not in t:
    t = t.replace("pruneForeignRooms, pruneRemoteCourts, collapseRoomPlaces } from './residence.js';",
                  "pruneForeignRooms, pruneRemoteCourts, collapseRoomPlaces, assignStaffQuarters } from './residence.js';")
    old2 = """      const collapsed = collapseRoomPlaces(world);   // 房间收回账上，不再各占一个地点"""
    new2 = """      // 住户按位份归位（正妻正房、二房东厢、丫鬟下房…）
      try {
        for (const [pid, pl] of Object.entries(world.places || {})) {
          if (pl && pl.rooms) assignStaffQuarters(world, pid);
        }
      } catch { /* 忽略 */ }
      const collapsed = collapseRoomPlaces(world);   // 房间收回账上，不再各占一个地点"""
    if old2 in t:
        t = t.replace(old2, new2, 1)
        io.open(p2, 'w', encoding='utf-8-sig').write(t)
        print('② 巡检补 quarters')
