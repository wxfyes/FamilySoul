import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '未找到对应接口' in l)
block = '''  // 手动推一格世界（验收用）：POST /api/admin/tick-run
  if (req.method === 'POST' && pathname === '/api/admin/tick-run') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const world = loadState(DATA_DIR);
      world.flags = world.flags || {};
      delete world.flags.lastTick;
      const tick = advanceWorldTick(world, Number(world.clock?.hour) || 0);
      saveState(DATA_DIR, world);
      return sendJson(res, 200, { ok: true, tick, day: world.clock?.day, hour: world.clock?.hour });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines.insert(idx, block)
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('tick-run 接口已加')
