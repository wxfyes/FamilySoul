import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 院子里有什么：GET /api/world/room?place=xxx"
add = """    // 世界日报：今天世界自己发生了什么（米价、民心、摊子、谁有了打算）
    if (req.method === 'GET' && matchRoute('/world/daily-report')) {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const world = loadState(DATA_DIR);
        const day = Number(world.clock?.day) || 1;
        const log = (world.flags?.tickLog || []).filter((x) => x && Number(x.day) === day).slice(-24);
        const goals = Object.values(world.actors || {})
          .filter((a) => a && !a.dead && a.goal && !String(a.id).startsWith('usr_'))
          .slice(0, 12)
          .map((a) => ({ name: a.name, doing: a.goal.text, 到: a.goal.due }));
        return sendJson(res, 200, { ok: true, day, log, goals });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

""" + anchor
if '世界日报' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① /api/world/daily-report')
