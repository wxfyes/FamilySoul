import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 流动小贩不算"住进来的人"
if 'ITINERANT' not in s:
    s = s.replace("/** 下人按本分住哪 */", """/** 挑担走街的流动人口：卖花、货郎、挑夫、轿夫、游侠……他们不该寄居在别人民宅 */
const ITINERANT = /卖花|货郎|挑夫|轿夫|行商|客商|游侠|乞儿|流民|脚夫|走街|串巷/;

/** 下人按本分住哪 */""", 1)
    s = s.replace("""  let placed = 0;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;""",
"""  let placed = 0;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    if (ITINERANT.test(String(a.role || ''))) continue;   // 流动小贩不占宅子""",1)
    print('① 流动小贩不占宅')

# ② 把已经寄居在别人宅子里的流动小贩请回街上
if 'export function settleItinerants' not in s:
    s = s.rstrip() + '''

/**
 * 流动小贩归位：卖花女、货郎、挑夫这些不该住在别人家里。
 * 只动人，不动房；每天巡检一次。
 */
export function settleItinerants(world) {
  let moved = 0;
  const street = world?.places?.street ? 'street' : null;
  for (const a of Object.values(world?.actors || {})) {
    if (!a || a.dead) continue;
    if (!ITINERANT.test(String(a.role || ''))) continue;
    const home = world.places?.[a.home];
    const squatting = home && home.residence && home.owner && home.owner !== a.id;
    if (!squatting && a.location !== a.home) continue;
    if (home && home.owner === a.id) continue;
    if (!street) continue;
    a.home = street;
    if (world.places?.[a.location]?.residence) a.location = street;
    delete a.quarters;
    moved += 1;
  }
  return moved;
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('② 加 settleItinerants')
else:
    io.open(p, 'w', encoding='utf-8-sig').write(s)

# ③ state.js：每天巡检时把小贩请回街
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { buildAllResidences, relinkResidence } from './residence.js';",
              "import { buildAllResidences, relinkResidence, settleItinerants } from './residence.js';")
anchor = "  // 每次读档：把已有宅子的门路与房名理顺（不建东西，很便宜）"
add = """  // 流动小贩归位：卖花女/货郎不许寄居在别人宅子里
  try {
    const n = settleItinerants(world);
    if (n) console.log(`[Residence] 把 ${n} 个流动小贩请回街市`);
  } catch { /* 忽略 */ }

""" + anchor
if '请回街市' not in t:
    t = t.replace(anchor, add, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('③ 迁移里请回街市')
