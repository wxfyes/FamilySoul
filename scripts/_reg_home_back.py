import io
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 恢复"自己的百姓小屋"，但只有一间，不铺张
old = """    // 不白送宅子：先落脚客栈，住处与营生由他在世界里自己挣
"""
new = """    // 开局给他一处自己的百姓小屋：不为剧情，只为"有地方落脚"
    const houseId = `house_${actorId}`;
    world.places = world.places || {};
    if (!world.places[houseId]) {
      world.places[houseId] = {
        id: houseId,
        name: `${rawName}的小院`,
        exits: ['street'],
        owner: actorId,
        residence: true,
        dynamic: true,
        createdDay: world.clock?.day || 1,
      };
      world.dynamicPlaces = world.dynamicPlaces || {};
      world.dynamicPlaces[houseId] = world.places[houseId];
      try {
        if (world.places.street) {
          world.places.street.exits = Array.isArray(world.places.street.exits) ? world.places.street.exits : [];
          if (!world.places.street.exits.includes(houseId)) world.places.street.exits.push(houseId);
        }
      } catch { /* 忽略 */ }
    }
"""
if old in s and '百姓小屋' not in s:
    s = s.replace(old, new, 1)
    print('① 恢复小屋')

s = s.replace("      home: null,\n      location: 'inn',", "      home: houseId,\n      location: houseId,", 1)
s = s.replace("      residence: null,", "      residence: { type: 'own', placeId: houseId },", 1)
s = s.replace("落脚在临江客栈。", "落脚在自家小院。", 1)
s = s.replace("初涉江湖，落脚临江客栈。", "初涉江湖，落脚自家小院。", 1)
s = s.replace("），落脚临江客栈，天道已建档", "），落脚自家小院，天道已建档", 1)
s = s.replace("      place: '临江客栈',", "      place: `${rawName}的小院`,", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('② 开局在自己家，二两碎银')
