import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '未找到对应接口' in l)
block = '''  // 体检：状态读写、内存、耗时 GET /api/admin/perf
  if (req.method === 'GET' && pathname === '/api/admin/perf') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const world = peek(DATA_DIR);
      const st = globalThis.__stateStats || {};
      let stateBytes = 0;
      try { stateBytes = fs.statSync(path.join(DATA_DIR, 'world', 'state.json')).size; } catch { /* 忽略 */ }
      const mem = process.memoryUsage();
      return sendJson(res, 200, {
        ok: true,
        rssMB: Math.round(mem.rss / 1048576),
        heapMB: Math.round(mem.heapUsed / 1048576),
        uptimeSec: Math.round(process.uptime()),
        stateMB: Math.round(stateBytes / 1048576 * 100) / 100,
        actors: Object.keys(world.actors || {}).length,
        places: Object.keys(world.places || {}).length,
        events: Array.isArray(world.events) ? world.events.length : 0,
        state: st,
        chat: globalThis.__chatStats || null,
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines.insert(idx, block)
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('perf 接口')
