import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { buildAllResidences, relinkResidence, upgradeResidence, settleItinerants, buildPremises, buildCourts } from './residence.js';",
              "import { buildAllResidences, relinkResidence, upgradeResidence, settleItinerants, buildPremises, buildCourts, pruneForeignRooms } from './residence.js';")
anchor = "  // 每次读档：把已有宅子的门路与房名理顺（不建东西，很便宜）"
add = """  // 每次读档：清掉"串了模板"的房间（酒楼里有正房、衙署里有灶房这种）
  try {
    const n = pruneForeignRooms(world);
    if (n) console.log(`[Spaces] 清掉 ${n} 间串模板的房间`);
  } catch { /* 忽略 */ }

""" + anchor
if '[Spaces]' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('读档即清串模板')
