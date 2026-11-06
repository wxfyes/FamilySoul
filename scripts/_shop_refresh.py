import io
# 验收接口：立即重算所有产业日入
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '未找到对应接口' in l)
block = '''  // 验收：立即重算产业日入 POST /api/admin/shop-refresh
  if (req.method === 'POST' && pathname === '/api/admin/shop-refresh') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const world = loadState(DATA_DIR);
      const n = refreshPropertyIncomes(world);
      saveState(DATA_DIR, world);
      const list = (world.assets?.properties || []).map((p) => ({ name: p.name, status: p.status, income: p.incomePerDay }));
      return sendJson(res, 200, { ok: true, count: n, list });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines.insert(idx, block)
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('加 shop-refresh')
