import io

# ① 时钟：每小时让宅中人按院子作息走动
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'roomForHour' not in s:
    s = s.replace("import { evictTrespassers } from './dwelling.js';",
                  "import { evictTrespassers } from './dwelling.js';\nimport { roomForHour } from './room-life.js';")
    if 'roomForHour' not in s:
        s = s.replace("import { runMigration, settleMigrants } from './migration.js';",
                      "import { runMigration, settleMigrants } from './migration.js';\nimport { roomForHour } from './room-life.js';")
    anchor = "  // 每小时：私宅巡检"
    add = """  // 每小时：宅中人的作息（按他住的院子与这间院子的用处走，房间没展开就先展开）
  try {
    const hourNow = Number(world.clock?.hour) || 0;
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.jailed || a.away) continue;
      if (!a.home || !world.places?.[a.home]) continue;
      if (!/宅|府|院/.test(String(world.places[a.home].name || ''))) continue;
      const to = roomForHour(world, a, hourNow);
      if (!to || to === a.location) continue;
      const r = moveActor(world, a.id, to, 'world', '按作息走动');
      if (r?.ok) a.activity = { text: '在自己宅里走动', at: hourNow, day: world.clock?.day || 1 };
    }
  } catch (err) {
    console.warn('[RoomLife] 作息失败：', err.message);
  }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('① 时钟接入院落作息')

# ② 天道上下文：把"此间陈设 / 可做之事 / 在场者"摆了给它
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'describeRoom' not in t:
    t = t.replace("import { resolvePlaceTarget } from './world/places-target.js';",
                  "import { resolvePlaceTarget } from './world/places-target.js';\nimport { describeRoom } from './world/room-life.js';")
    anchor2 = "    // 苦主求庇：本地或邻道有 2 阶以上匪患"
    add2 = """    // 此间陈设与可做之事：只给事实，怎么接戏由天道决定
    try {
      const wRoom = loadState(this.dataDir);
      const meRoom = this._viewerActorId ? wRoom.actors?.[this._viewerActorId] : wRoom.actors?.husband;
      const rd = describeRoom(wRoom, meRoom?.location);
      if (rd && rd.furnish?.length) {
        contextHintEarly += `（【此间】${rd.name}：有${rd.furnish.join('、')}。` +
          `在场的人：${rd.occupants.filter((x) => x.id !== meRoom?.id).map((x) => x.name).join('、') || '无人'}。` +
          `在这里能做的事：${(rd.can || []).join('、')}。要写就照着陈设写，别凭空添不存在的物件。）\\n`;
      }
    } catch { /* 忽略 */ }

""" + anchor2
    if anchor2 in t:
        t = t.replace(anchor2, add2, 1)
        io.open(p2, 'w', encoding='utf-8-sig').write(t)
        print('② 天道看到此间陈设')
