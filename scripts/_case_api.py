import io
# ③ 补旧城的商会（extras）
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const slug = city.replace(/府$|县$|州$/g, '');
  for (const role of ['乡绅', '衙役']) {"""
new = """  const slug = city.replace(/府$|县$|州$/g, '');
  try {
    world.guilds = world.guilds || {};
    if (!world.guilds[city]) {
      world.guilds[city] = { name: `${city}商会`, city, head: null, headName: '', dues: 2, attitude: 'neutral' };
      n += 1;
    }
  } catch { /* 忽略 */ }
  for (const role of ['乡绅', '衙役']) {"""
if old in s and 'world.guilds[city]' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('③ 旧城补商会')

# ④ 验收接口：立刻在指定城生成一桩案子
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
lines = t.split('\n')
idx = next(i for i, l in enumerate(lines) if '未找到对应接口' in l)
block = '''  // 验收：立刻在某城生成一桩案子 POST /api/admin/case-now {city}
  if (req.method === 'POST' && pathname === '/api/admin/case-now') {
    try {
      const body = await parseJsonBody(req, 8 * 1024);
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const city = String(body.city || '临江府');
      const w = loadState(DATA_DIR);
      w.flags = w.flags || {};
      w.flags.pendingCase = { city, day: w.clock?.day || 1 };
      saveState(DATA_DIR, w);
      await globalThis.__worldGenerators?.generateCase?.();
      const after = loadState(DATA_DIR);
      const c = (after.cases || []).slice(-1)[0] || null;
      return sendJson(res, 200, { ok: true, case: c });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines.insert(idx, block)
io.open(p2, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('④ case-now 接口')
