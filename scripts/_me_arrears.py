import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          monthlyPay: Math.round((Number(f.troops) || 0) * 1.0 * 100) / 100,
          monthlyGrain: Math.round((Number(f.troops) || 0) * 0.02 * 30 * 100) / 100,"""
new = """          monthlyPay: Math.round((Number(f.troops) || 0) * 1.0 * 100) / 100,
          monthlyGrain: Math.round((Number(f.troops) || 0) * 0.02 * 30 * 100) / 100,
          arrears: f.arrears || { months: 0, owed: 0 },"""
if old in s and 'arrears: f.arrears' not in s.split('/api/me')[0][-50000:]:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('api/me factions 带 arrears')
