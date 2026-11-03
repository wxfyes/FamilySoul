with open('src/world/dispatch.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''function resolvePlace(world, to) {
  if (!to) return null;
  const raw = String(to).trim();
  const alias = {
    我房间: 'husband_room', 我的房间: 'husband_room', 正房: 'husband_room', 上房: 'husband_room', 卧房: 'husband_room', 寝室: 'husband_room', 房里: 'husband_room', 我房里: 'husband_room',
    clinic: '医馆', 药铺: '医馆', 药堂: '医馆', 医馆: '医馆',
    workshop: '匠作坊', school: '学堂', dock: 'dock', granary: '粮仓', inn: 'inn',
  };
  const key = alias[raw] && world.places?.[alias[raw]] ? alias[raw] : (alias[raw] || raw);
  if (world.places?.[key]) return key;
  for (const [id, p] of Object.entries(world.places || {})) {
    if (p?.name && (p.name.includes(key) || key.includes(p.name))) return id;
  }
  return null;
}'''

replacement = '''function resolvePlace(world, to) {
  if (!to) return null;
  const raw = String(to).trim();

  // 1. 核心场所收束（子房间/后堂/公堂统归主建筑，杜绝异次元分裂）
  if (/(县衙|衙门|公堂|后堂|县衙后堂|后院|县衙后院|偏厅|正堂|大堂|衙内)/.test(raw) && !/(牢|狱)/.test(raw)) {
    if (world.places?.yamen) return 'yamen';
  }
  if (/(男牢|男监|大牢|牢房|牢里|大狱|监牢|下狱)/.test(raw)) {
    if (world.places?.jail_male) return 'jail_male';
  }
  if (/(女牢|女监)/.test(raw)) {
    if (world.places?.jail_female) return 'jail_female';
  }
  if (/(青石板|长街|大街|街上|街道|街市|街心|当街)/.test(raw)) {
    if (world.places?.street) return 'street';
  }
  if (/(茶坊|茶肆|茶楼|老店|茶房)/.test(raw)) {
    if (world.places?.tea_house) return 'tea_house';
    if (world.places?.teahouse) return 'teahouse';
  }
  if (/(雅阁|雅间)/.test(raw)) {
    if (world.places?.yage) return 'yage';
    if (world.places?.tea_house) return 'tea_house';
  }
  if (/(大酒楼|三层大酒楼|运河酒楼|运河大酒楼|酒楼雅间|酒楼二楼|酒楼三楼|酒楼)/.test(raw)) {
    if (world.places?.restaurant) return 'restaurant';
  }
  if (/(于家酒肆|紫嫣酒肆|酒肆|小酒馆)/.test(raw)) {
    if (world.places?.jiusi) return 'jiusi';
  }
  if (/(码头|渡口|江边)/.test(raw)) {
    if (world.places?.dock) return 'dock';
  }

  const alias = {
    我房间: 'husband_room', 我的房间: 'husband_room', 正房: 'husband_room', 上房: 'husband_room', 卧房: 'husband_room', 寝室: 'husband_room', 房里: 'husband_room', 我房里: 'husband_room',
    clinic: '医馆', 药铺: '医馆', 药堂: '医馆', 医馆: '医馆',
    workshop: '匠作坊', school: '学堂', dock: 'dock', granary: '粮仓', inn: 'inn',
  };
  const key = alias[raw] && world.places?.[alias[raw]] ? alias[raw] : (alias[raw] || raw);
  if (world.places?.[key]) return key;
  for (const [id, p] of Object.entries(world.places || {})) {
    if (p?.name && (p.name.includes(key) || key.includes(p.name))) return id;
  }
  return null;
}'''

if target in text:
    text = text.replace(target, replacement)
    with open('src/world/dispatch.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully replaced resolvePlace in dispatch.js")
else:
    print("Target not found in dispatch.js")

