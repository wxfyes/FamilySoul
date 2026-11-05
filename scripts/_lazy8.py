import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("pruneForeignRooms, pruneRemoteCourts } from './residence.js';",
              "pruneForeignRooms, pruneRemoteCourts, collapseRoomPlaces } from './residence.js';", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('补 collapseRoomPlaces 导入')
