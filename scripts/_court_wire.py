import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { buildAllResidences, relinkResidence, settleItinerants, buildPremises } from './residence.js';",
              "import { buildAllResidences, relinkResidence, settleItinerants, buildPremises, buildCourts } from './residence.js';")
anchor = "  // 经营场所立体化：三层酒楼、前店后坊、茶坊雅间（只建有主的，幂等）"
add = """  // 官府衙署层级化：照壁/大堂/二堂/花厅/大牢/校场（幂等）
  try {
    const n = buildCourts(world);
    if (n) console.log(`[Court] 建出 ${n} 间衙署房舍`);
  } catch { /* 忽略 */ }

""" + anchor
if '[Court]' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('③ 巡检建衙署')
