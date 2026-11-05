import io
# /api/me 的 factions 也带月饷
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          strength: factionStrength(world, f),
          cities: (f.cities || []).slice(0, 12),
          gear: f.gear || {},
          fresh: Number(f.fresh) || 0,"""
new = """          strength: factionStrength(world, f),
          cities: (f.cities || []).slice(0, 12),
          gear: f.gear || {},
          monthlyPay: Math.round((Number(f.troops) || 0) * 1.0 * 100) / 100,
          monthlyGrain: Math.round((Number(f.troops) || 0) * 0.02 * 30 * 100) / 100,
          fresh: Number(f.fresh) || 0,"""
if old in s and 'monthlyPay: Math.round((Number(f.troops)' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('/api/me factions 带月饷')
