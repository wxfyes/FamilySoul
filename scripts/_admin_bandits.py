import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          factions: Object.values(world.factions || {}).map((f) => ({"""
new = """          bandits: Object.values(world.bandits || {}).map((b) => ({
            id: b.id, name: b.name, kind: b.kind, tier: b.tier, strength: b.strength,
            leader: b.leader, homeCity: b.homeCity, silver: b.silver, grain: b.grain, region: b.region,
          })),
          factions: Object.values(world.factions || {}).map((f) => ({"""
# 只改 admin/world 这一处（它带 ownerName 那段之后）
if 'bandits: Object.values(world.bandits' not in s.split('admin/world')[1][:8000]:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('admin 负载补 bandits')
