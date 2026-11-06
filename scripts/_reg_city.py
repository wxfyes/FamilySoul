import io
# ① 新人随机落地一座城（先把该城基底铺好，再给他在城里安家）
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { addMemory } from './world/memory.js';",
              "import { addMemory } from './world/memory.js';\nimport { ensureCityBase, streetOfCity } from './world/city.js';", 1)
old = """    // 开局给他一处自己的百姓小屋：不为剧情，只为"有地方落脚"
    const houseId = `house_${actorId}`;
    world.places = world.places || {};
    if (!world.places[houseId]) {"""
new = """    // 随机落在一座城：先把这座城的基底铺出来（街市/客栈/铺面/住户）
    let cityName = '';
    try {
      const cities = Object.keys(world.cities || {}).filter((c) => !/京城|洛阳|汴梁/.test(c) || Math.random() < 0.3);
      const pool = cities.length ? cities : Object.keys(world.cities || {});
      cityName = pool[Math.floor(Math.random() * pool.length)] || '';
      if (cityName) ensureCityBase(world, cityName);
    } catch { /* 忽略 */ }
    const slug = String(cityName || '临江').replace(/府$|县$|州$/g, '');
    const streetId = (cityName && streetOfCity(world, cityName)) || 'street';

    // 开局给他一处自己的百姓小屋：不为剧情，只为"有地方落脚"
    const houseId = `${slug}_house_${actorId}`;
    world.places = world.places || {};
    if (!world.places[houseId]) {"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 随机落地城')

# 房子的门路连到这座城的主街
old2 = """        exits: ['street'],
        owner: actorId,"""
new2 = """        exits: [streetId],
        owner: actorId,"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 家门连本城街')
io.open(p, 'w', encoding='utf-8-sig').write(s)
