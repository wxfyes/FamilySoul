import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 开场过门人：给自家住处 + 作息 + 性别推断，绝不占玩家私宅
old = """            world.actors[nid] = {
              id: nid, name: whoName, role: whoRole, gender: 'unknown',
              home: a.location, location: a.location, money: 0, relations: {}, schedule: [],
              origin: 'dm_opening', createdDay: world.clock?.day || 1,
            };"""
new = """            // 过门人：有自己的家、有作息；绝不把玩家的私宅当自己家
            const isHomeOfPlayer = Boolean(world.places?.[a.location]?.residence);
            world.actors[nid] = {
              id: nid, name: whoName, role: whoRole,
              gender: inferGenderFromIdentity(whoName, whoRole, 'male'),
              age: inferAgeFromIdentity(whoName, whoRole, '', nid),
              money: round2(0.3 + Math.random() * 2),
              relations: {},
              origin: 'dm_opening', createdDay: world.clock?.day || 1,
            };
            const nearId = isHomeOfPlayer ? 'street' : (world.places?.[a.location] && !world.places[a.location].residence ? a.location : 'street');
            const ownHome = ensureDwelling(world, nid, whoName, nearId);
            world.actors[nid].home = ownHome;
            world.actors[nid].location = nearId === 'street' ? ownHome : nearId;
            world.actors[nid].schedule = defaultSchedule(whoRole, nearId, ownHome);"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 过门人有自己家与作息')

# ② 引入 helper
if 'dwelling.js' not in s:
    anchor = "import { visiblePropertiesOf } from './world/employment.js';"
    s = s.replace(anchor, anchor + "\nimport { ensureDwelling, defaultSchedule } from './world/dwelling.js';", 1)
    print('② 引入 dwelling')
io.open(p, 'w', encoding='utf-8-sig').write(s)
