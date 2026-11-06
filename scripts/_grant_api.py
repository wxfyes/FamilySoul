import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '未找到对应接口' in l)
block = '''  // 维护：一笔入账（启动本钱/补偿） POST /api/admin/grant {amount,title}
  if (req.method === 'POST' && pathname === '/api/admin/grant') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const body = await parseJsonBody(req, 8 * 1024);
      const amount = Math.round(Number(body.amount || 0) * 100) / 100;
      if (!(amount > 0)) return sendJson(res, 200, { ok: false, error: '金额不对' });
      const world = peek(DATA_DIR);
      world.assets = world.assets || {};
      world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + amount) * 100) / 100;
      world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
      world.ledger.push({ day: world.clock?.day || 1, hour: world.clock?.hour || 0, delta: amount, title: String(body.title || '入账').slice(0, 24), by: 'husband', balance: world.assets.silver });
      saveState(DATA_DIR, world);
      return sendJson(res, 200, { ok: true, silver: world.assets.silver });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines.insert(idx, block)
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('grant 接口')
