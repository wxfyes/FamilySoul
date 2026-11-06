import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '未找到对应接口' in l)
block = '''  // 世界日报：今天世界自己发生了什么
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
        .map((a) => ({ name: a.name, doing: a.goal.text, due: a.goal.due }));
      return sendJson(res, 200, { ok: true, day, log, goals });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines.insert(idx, block)
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('日报接口插到 404 之前')
