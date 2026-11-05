import io
# ① state.js：巡检时也建经营场所
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { buildAllResidences, relinkResidence, settleItinerants } from './residence.js';",
              "import { buildAllResidences, relinkResidence, settleItinerants, buildPremises } from './residence.js';")
anchor = "  // 流动小贩归位：卖花女/货郎不许寄居在别人宅子里"
add = """  // 经营场所立体化：三层酒楼、前店后坊、茶坊雅间（只建有主的，幂等）
  try {
    const n = buildPremises(world);
    if (n) console.log(`[Premises] 建出 ${n} 间经营空间`);
  } catch { /* 忽略 */ }

""" + anchor
if '[Premises]' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 巡检建经营空间')
