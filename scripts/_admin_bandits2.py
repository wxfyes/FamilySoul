import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if 'ownerName: pr.owner ===' in l)
# 在其后的 "}," 行后插入 bandits
ins = idx + 2  # 跳过 })), 与 },
block = """          bandits: Object.values(world.bandits || {}).map((b) => ({
            id: b.id, name: b.name, kind: b.kind, tier: b.tier, strength: b.strength,
            leader: b.leader, homeCity: b.homeCity, silver: b.silver, grain: b.grain, region: b.region,
          })),"""
lines = lines[:ins] + block.split('\n') + lines[ins:]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('admin 负载插入 bandits（行', ins + 1, '）')
