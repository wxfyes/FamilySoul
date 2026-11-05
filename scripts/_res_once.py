import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  // 每次读档巡检宅子：没院子的建、院子不够的补、门路连上、下人按本分安置
  try {
    const r = buildAllResidences(world);
    if (r.homes || r.rooms) console.log(`[Residence] 建/补 ${r.homes} 座宅院，共 ${r.rooms} 间院子`);
  } catch (e) {
    console.warn('[Residence] 宅院巡检失败：', e.message);
  }
"""
new = """  // 宅院巡检：同一个世界日只跑一次（不然每次读档都扫一千多个地点，接口会被拖死）
  try {
    world.flags = world.flags || {};
    const today = String(world.clock?.day || 1);
    if (String(world.flags.residenceSweptDay || '') !== today) {
      const r = buildAllResidences(world);
      world.flags.residenceSweptDay = today;
      if (r.homes || r.rooms) console.log(`[Residence] 建/补 ${r.homes} 座宅院，共 ${r.rooms} 间院子`);
    }
  } catch (e) {
    console.warn('[Residence] 宅院巡检失败：', e.message);
  }
"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('巡检改成每日一次')
