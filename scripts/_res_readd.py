import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "export function migrateOwnership(world) {"
block = anchor + """
  // 每次读档巡检宅子：没院子的建、院子不够的补、门路连上、下人按本分安置
  try {
    const r = buildAllResidences(world);
    if (r.homes || r.rooms) console.log(`[Residence] 建/补 ${r.homes} 座宅院，共 ${r.rooms} 间院子`);
  } catch (e) {
    console.warn('[Residence] 宅院巡检失败：', e.message);
  }
"""
if 'buildAllResidences(world);\n    if (r.homes' not in s.split(anchor)[1][:400] if anchor in s else False:
    pass
if '巡检宅子：没院子的建' not in s:
    s = s.replace(anchor, block, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('重新挂上宅院巡检')
else:
    print('已存在')
