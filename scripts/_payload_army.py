import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          strength: factionStrength(world, f), cities: (f.cities || []).slice(0, 12),"""
new = """          strength: factionStrength(world, f), cities: (f.cities || []).slice(0, 12),
          stationed: f.stationed || {}, marches: (f.marches || []).map((m) => ({ to: m.to, troops: m.troops, arriveDay: m.arriveDay })),"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('负载补驻扎与行军')
