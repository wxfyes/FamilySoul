import io
# 巡检里也给有人的宅子补门房（老存档也能有门房）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("pruneForeignRooms, pruneRemoteCourts, collapseRoomPlaces, assignStaffQuarters } from './residence.js';",
              "pruneForeignRooms, pruneRemoteCourts, collapseRoomPlaces, assignStaffQuarters } from './residence.js';\nimport { ensureGatekeeper } from './posts.js';", 1)
old = """          if (pl && pl.rooms) assignStaffQuarters(world, pid);"""
new = """          if (pl && pl.rooms) {
            assignStaffQuarters(world, pid);
            if (pl.residence) ensureGatekeeper(world, pid);
          }"""
if old in s and 'ensureGatekeeper(world, pid)' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 巡检补门房')
