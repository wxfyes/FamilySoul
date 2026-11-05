import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 诊断：宅院状态（临时）"
block = '''    // 空间体检：清串模板房间、补经营场所与衙署、流动小贩归位（一次性手动触发后落盘）
    if (req.method === 'POST' && pathname === '/api/admin/spaces-sweep') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '令牌无效' });
        const world = loadState(DATA_DIR);
        const pruned = pruneForeignRooms(world);
        const settled = settleItinerants(world);
        const prem = buildPremises(world);
        const court = buildCourts(world);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, {
          ok: true,
          pruned, settled, premises: prem, courts: court,
          places: Object.keys(world.places || {}).length,
          restaurant: Object.values(world.places?.canal_restaurant?.rooms || {}).map((r) => r.name),
          yamen: Object.values(world.places?.yamen?.rooms || {}).map((r) => r.name),
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

''' + anchor
if '/api/admin/spaces-sweep' not in s:
    if 'pruneForeignRooms' not in s:
        s = s.replace("import { ensureResidence, repairRooms } from './world/residence.js';",
                      "import { ensureResidence, repairRooms, pruneForeignRooms, settleItinerants, buildPremises, buildCourts } from './world/residence.js';")
    s = s.replace(anchor, block, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加 spaces-sweep 接口')
