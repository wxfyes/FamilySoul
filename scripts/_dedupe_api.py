import io
# 媒婆起名唯一
p = 'src/world/marriage.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const name = `${['王', '李', '张', '刘', '陈'][Math.floor(Math.random() * 5)]}媒婆`;"""
new = """  const usedNames = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
  let name = '';
  for (let i = 0; i < 20; i += 1) {
    const cand = `${['王', '李', '张', '刘', '陈', '赵', '孙', '周'][Math.floor(Math.random() * 8)]}媒婆`;
    if (!usedNames.has(cand)) { name = cand; break; }
  }
  if (!name) name = `${city}媒婆`;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('媒婆唯一')

# 独立去重接口
p2 = 'src/server.js'
lines = io.open(p2, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '未找到对应接口' in l)
block = '''  // 验收/维护：全服重名改正 POST /api/admin/name-dedupe
  if (req.method === 'POST' && pathname === '/api/admin/name-dedupe') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const world = loadState(DATA_DIR);
      const keep = new Set();
      const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.name);
      all.sort((a, b) => (Number(a.createdDay) || 0) - (Number(b.createdDay) || 0));
      const renamed = [];
      for (const a of all) {
        if (!keep.has(a.name)) { keep.add(a.name); continue; }
        if (a.id === 'husband' || String(a.id).startsWith('usr_')) continue;
        const base = a.name;
        const suf = ['二', '三', '四', '五', '六', '七', '八', '九', '十'];
        let nm = base;
        for (let i = 0; i < suf.length && keep.has(nm); i += 1) nm = base + suf[i];
        if (keep.has(nm)) continue;
        renamed.push(`${base}→${nm}`);
        a.name = nm;
        keep.add(nm);
      }
      saveState(DATA_DIR, world);
      return sendJson(res, 200, { ok: true, renamed: renamed.length, sample: renamed.slice(0, 12) });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines.insert(idx, block)
io.open(p2, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('去重接口')
