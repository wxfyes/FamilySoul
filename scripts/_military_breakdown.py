import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        military: troops > 0 ? { guards: f.guards || 0, militia: f.militia || 0, army: f.army || 0, supplies:"""
new = """        military: troops > 0 ? { guards: f.guards || 0, militia: f.militia || 0, army: f.army || 0,
          // 家丁 / 护院 / 私兵 分列（账上兵额 + 府里真人）
          kinds: f.kinds || {},
          retainers: (() => { let n = 0; for (const a of Object.values(world.actors || {})) { if (a && !a.dead && a.role === '护院') n += 1; } return n; })(),
          houseGuards: (() => { let n = 0; for (const a of Object.values(world.actors || {})) { if (a && !a.dead && a.role === '家丁') n += 1; } return n; })(),
          troops: Number(f.troops) || 0,
          supplies:"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('兵额分列')
