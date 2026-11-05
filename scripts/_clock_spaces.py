import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'pruneForeignRooms' not in s:
    s = s.replace("import { evictTrespassers } from './dwelling.js';",
                  "import { evictTrespassers } from './dwelling.js';\nimport { pruneForeignRooms, buildPremises, buildCourts, settleItinerants } from './residence.js';")
    anchor = "  // 每月初一：中馈月例（公中拨银给主母操持内宅）"
    add = """  // 每日：空间体检（清串模板房间、补经营场所与衙署、把流动小贩请回街）
  // 放在日结里，是因为日结必然会把世界落盘，改动能真正写进去
  try {
    const a = pruneForeignRooms(world);
    const b = settleItinerants(world);
    const c = buildPremises(world);
    const d = buildCourts(world);
    if (a || b || c || d) console.log(`[Spaces] 日结体检：清 ${a}｜小贩归位 ${b}｜经营 ${c}｜衙署 ${d}`);
  } catch (err) {
    console.warn('[Spaces] 空间体检失败：', err.message);
  }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('日结里做空间体检（会落盘）')
