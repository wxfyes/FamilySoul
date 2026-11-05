import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
# 在 decrees 行之后插入 factions（api/me 负载）
idx = next(i for i, l in enumerate(lines) if "decrees: (world.court?.decisions || [])" in l)
block = """        factions: Object.values(world.factions || {}).map((f) => ({
          id: f.id, name: f.name, kind: f.kind, leader: f.leader,
          troops: Number(f.troops) || 0,
          grain: Math.round((Number(f.grain) || 0) * 10) / 10,
          silver: Math.round(factionSilver(world, f) * 100) / 100,
          morale: Number(f.morale) || 0, ambition: Number(f.ambition) || 0,
          strength: factionStrength(world, f),
          cities: (f.cities || []).slice(0, 12),
          gear: f.gear || {},
          fresh: Number(f.fresh) || 0,
          freshUntilDay: Number(f.freshUntilDay) || 0,
          stationed: f.stationed || {},
        })),"""
lines = lines[:idx+1] + block.split('\n') + lines[idx+1:]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('api/me 负载加 factions')
