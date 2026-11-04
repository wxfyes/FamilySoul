import io

# ============ ① 注册：一人一座小院 + 婚配/住处字段 ============
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """    // 录入世界账本（初来乍到投宿临江客栈，信赖度从 0 开始）
    world.actors[actorId] = {"""
new = """    // 一人一座小院：注册时就给他一处住处（不是所有人挤客栈）
    const houseId = `house_${actorId}`;
    world.places = world.places || {};
    if (!world.places[houseId]) {
      const surname = rawName.slice(0, 1);
      world.places[houseId] = {
        id: houseId,
        name: `${surname}家小院`,
        exits: ['street'],
        owner: actorId,
        residence: true,
        dynamic: true,
        createdDay: world.clock?.day || 1,
      };
      world.dynamicPlaces = world.dynamicPlaces || {};
      world.dynamicPlaces[houseId] = world.places[houseId];
    }

    // 录入世界账本（先投宿客栈落脚，另有自家小院）
    world.actors[actorId] = {"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 注册分配小院')

old2 = """      home: 'inn',
      location: 'inn',"""
new2 = """      home: houseId,
      location: 'inn',
      marital: 'single',
      spouse: null,
      residence: { type: 'own', placeId: houseId },"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 写入婚配与住处')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② 迁移：老注册号补齐小院/婚配/住处 ============
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "export function migrateOwnership(world) {"
add = """export function migrateOwnership(world) {
  // 注册玩家补齐"一人一院 + 婚配 + 住处"（历史注册没写这三样）
  try {
    world.places = world.places || {};
    for (const [id, a] of Object.entries(world.actors || {})) {
      if (!a || !a.name || a.dead) continue;
      if (!String(id).startsWith('usr_')) continue;

      if (!a.marital) a.marital = 'single';
      if (a.spouse === undefined) a.spouse = null;

      const needHouse = !a.residence || !a.residence.placeId || !world.places[a.residence.placeId];
      if (needHouse) {
        const houseId = `house_${id}`;
        if (!world.places[houseId]) {
          world.places[houseId] = {
            id: houseId,
            name: `${String(a.name).slice(0, 1)}家小院`,
            exits: ['street'],
            owner: id,
            residence: true,
            dynamic: true,
            createdDay: world.clock?.day || 1,
          };
          world.dynamicPlaces = world.dynamicPlaces || {};
          world.dynamicPlaces[houseId] = world.places[houseId];
        }
        a.residence = { type: 'own', placeId: houseId };
        if (!a.home || a.home === 'inn') a.home = houseId;
        console.log(`[Reg] ${a.name} 补上住处：${world.places[houseId].name}`);
      }
    }
  } catch { /* 忽略 */ }"""
if anchor in t and '注册玩家补齐' not in t:
    t = t.replace(anchor, add, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('③ 迁移补齐老注册号')
