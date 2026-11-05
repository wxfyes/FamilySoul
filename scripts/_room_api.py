import io
# ③ 接口：看这一间院子
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if '/api/world/room' not in s:
    s = s.replace("import { pruneForeignRooms, settleItinerants, buildPremises, buildCourts } from './world/residence.js';",
                  "import { pruneForeignRooms, settleItinerants, buildPremises, buildCourts } from './world/residence.js';\nimport { describeRoom } from './world/room-life.js';")
    anchor = "    // 空间体检"
    block = """    // 院子里有什么：GET /api/world/room?place=xxx
    if (req.method === 'GET' && pathname === '/api/world/room') {
      try {
        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const want = String(url.searchParams.get('place') || '').trim();
        const me = world.actors?.[actorId] || world.actors?.husband;
        const placeId = want || me?.location;
        const info = describeRoom(world, placeId);
        if (!info) return sendJson(res, 404, { ok: false, error: '没有这处地方' });
        return sendJson(res, 200, { ok: true, room: info, here: placeId === me?.location });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, block, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('③ 加 /api/world/room')
