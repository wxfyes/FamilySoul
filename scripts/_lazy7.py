import io
# ⑧ 迁移：把已存在的地点型房间收拢回父地点账上（每次 60s 巡检里做）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { buildAllResidences, relinkResidence, upgradeResidence, settleItinerants, buildPremises, buildCourts, pruneForeignRooms } from './residence.js';",
              "import { buildAllResidences, relinkResidence, upgradeResidence, settleItinerants, buildPremises, buildCourts, pruneForeignRooms, collapseRoomPlaces } from './residence.js';")
old = """      const a0 = pruneRemoteCourts(world);
      const a = pruneForeignRooms(world) + a0;"""
new = """      const collapsed = collapseRoomPlaces(world);   // 房间收回账上，不再各占一个地点
      const a0 = pruneRemoteCourts(world);
      const a = pruneForeignRooms(world) + a0;"""
if old in s and 'collapseRoomPlaces(world)' not in s:
    s = s.replace(old, new, 1)
    print('⑧ 巡检里收拢房间')
io.open(p, 'w', encoding='utf-8-sig').write(s)
