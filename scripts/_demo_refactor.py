import io
p = 'src/world/demography.js'
s = io.open(p, encoding='utf-8-sig').read()

# 抽出"补人"函数，供每月与一次性播种共用
if 'export function addUnmarried' not in s:
    s = s.replace("/** 每月：年轻未婚的人太少就补几个 */", """/**
 * 补几个市井新人（每月补人与初始播种共用）
 * @returns {string[]} 新增名字
 */
export function addUnmarried(world, want, events, nextEvent, tag = 'newcomer') {
  const added = [];
  for (let i = 0; i < Math.max(0, want); i += 1) {
    const female = Math.random() < 0.75;
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const given = (female ? GIVEN_F : GIVEN_M)[Math.floor(Math.random() * (female ? GIVEN_F.length : GIVEN_M.length))];
    const name = `${surname}${given}`;
    if (Object.values(world.actors || {}).some((a) => a && a.name === name)) continue;
    const id = `npc_demo_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const role = (female ? ROLES_F : ROLES_M)[Math.floor(Math.random() * (female ? ROLES_F.length : ROLES_M.length))];
    const street = STREETS[Math.floor(Math.random() * STREETS.length)];
    world.actors[id] = {
      id,
      name,
      role,
      gender: female ? 'female' : 'male',
      age: 16 + Math.floor(Math.random() * 9),
      money: Math.round((1 + Math.random() * 4) * 10) / 10,
      home: street,
      location: street,
      marital: 'single',
      origin: 'spawned',
      relations: { husband: { trust: 10, desire: 0, fear: 0, grievance: 0 } },
      schedule: [],
      createdDay: Number(world.clock?.day) || 1,
    };
    added.push(name);
  }
  if (added.length && events && nextEvent) {
    events.push(nextEvent(world, {
      action: tag, actor: 'system', place: null,
      payload: { text: `市井又来了几张新面孔：${added.join('、')}` }, isPublic: true,
    }));
  }
  return added;
}

/** 每月：年轻未婚的人太少就补几个 */""", 1)

# runDemography 改为调用 addUnmarried
old = """  const want = Math.min(5, 18 - pool.length);
  const added = [];
  for (let i = 0; i < want; i += 1) {
    const female = Math.random() < 0.75;
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const given = (female ? GIVEN_F : GIVEN_M)[Math.floor(Math.random() * (female ? GIVEN_F.length : GIVEN_M.length))];
    const name = `${surname}${given}`;
    if (Object.values(world.actors || {}).some((a) => a && a.name === name)) continue;

    const id = `npc_demo_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const role = (female ? ROLES_F : ROLES_M)[Math.floor(Math.random() * (female ? ROLES_F.length : ROLES_M.length))];
    const street = STREETS[Math.floor(Math.random() * STREETS.length)];
    world.actors[id] = {
      id,
      name,
      role,
      gender: female ? 'female' : 'male',
      age: 16 + Math.floor(Math.random() * 9),
      money: Math.round((1 + Math.random() * 4) * 10) / 10,
      home: street,
      location: street,
      marital: 'single',
      origin: 'spawned',
      relations: { husband: { trust: 10, desire: 0, fear: 0, grievance: 0 } },
      schedule: [],
      createdDay: day,
    };
    added.push(name);
  }

  if (added.length) {
    events?.push(nextEvent(world, {
      action: 'newcomer', actor: 'system', place: null,
      payload: { text: `市井又来了几张新面孔：${added.join('、')}` }, isPublic: true,
    }));
  }
  return added;"""
new = """  const want = Math.min(5, 18 - pool.length);
  return addUnmarried(world, want, events, nextEvent);"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 抽出 addUnmarried')
io.open(p, 'w', encoding='utf-8-sig').write(s)
