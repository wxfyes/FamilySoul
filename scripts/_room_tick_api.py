import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 院子里有什么：GET /api/world/room?place=xxx"
block = """    // 手动跑一次院落作息（验收用）：POST /api/admin/room-tick
    if (req.method === 'POST' && pathname === '/api/admin/room-tick') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '令牌无效' });
        const world = loadState(DATA_DIR);
        const hourNow = Number(world.clock?.hour) || 0;
        const moved = [];
        for (const a of Object.values(world.actors || {})) {
          if (!a || a.dead || a.jailed || a.away) continue;
          if (!a.home || !world.places?.[a.home]) continue;
          if (!/宅|府|院/.test(String(world.places[a.home].name || ''))) continue;
          const to = roomForHour(world, a, hourNow);
          if (!to || to === a.location) continue;
          const r = moveActor(world, a.id, to, 'world', '按作息走动');
          if (r?.ok) { moved.push(`${a.name}→${world.places?.[to]?.name || to}`); a.activity = { text: '在自己宅里走动', at: hourNow, day: world.clock?.day || 1 }; }
        }
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, hour: hourNow, moved, places: Object.keys(world.places || {}).length });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

""" + anchor
if '/api/admin/room-tick' not in s:
    s = s.replace(anchor, block, 1)
    if 'roomForHour' not in s.split('function ')[0]:
        s = s.replace("import { describeRoom } from './world/room-life.js';",
                      "import { describeRoom, roomForHour } from './world/room-life.js';")
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 加验收用 room-tick')
