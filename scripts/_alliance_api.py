import io
p = 'src/world/marriage.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("export function maybeOfferAlliance(world, playerId = 'husband') {",
              "export function maybeOfferAlliance(world, playerId = 'husband', force = false) {", 1)
s = s.replace("  if (Math.random() > 0.45) return null;", "  if (!force && Math.random() > 0.45) return null;", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('force 参数')

p2 = 'src/server.js'
lines = io.open(p2, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '未找到对应接口' in l)
block = '''  // 验收：立刻让大户来提亲 POST /api/admin/alliance-now
  if (req.method === 'POST' && pathname === '/api/admin/alliance-now') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const world = loadState(DATA_DIR);
      world.flags = world.flags || {};
      world.flags.allianceCheckedDay = 0;
      world.flags.allianceOffer = null;
      const offer = maybeOfferAlliance(world, String(member.actor || 'husband'), true);
      saveState(DATA_DIR, world);
      return sendJson(res, 200, { ok: Boolean(offer), offer: offer || null });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines.insert(idx, block)
io.open(p2, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('alliance-now 接口')
