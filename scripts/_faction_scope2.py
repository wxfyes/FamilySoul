import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
start = next(i for i, l in enumerate(lines) if 'factions: Object.values(world.factions || {}).map((f) => ({' in l)
end = start
while not (lines[end].strip() == '})),' ):
    end += 1
new = """        factions: (() => {
          const meId = actorId || 'husband';
          const isBoss = meId === 'husband' || world.factions?.wangjia?.leader === meId;
          return Object.values(world.factions || {}).map((f) => {
            const visible = Boolean(f) && (f.id !== 'wangjia' || isBoss);
            return {
              id: f.id, name: f.name, kind: f.kind, leader: f.leader,
              troops: visible ? (Number(f.troops) || 0) : null,
              grain: visible ? Math.round((Number(f.grain) || 0) * 10) / 10 : null,
              silver: visible ? Math.round(factionSilver(world, f) * 100) / 100 : null,
              morale: Number(f.morale) || 0,
              ambition: Number(f.ambition) || 0,
              strength: visible ? factionStrength(world, f) : null,
              cities: (f.cities || []).slice(0, 12),
              gear: visible ? (f.gear || {}) : {},
              kinds: visible ? (f.kinds || {}) : {},
              monthlyPay: visible ? Math.round((Number(f.troops) || 0) * 1.0 * 100) / 100 : null,
              monthlyGrain: visible ? Math.round((Number(f.troops) || 0) * 0.02 * 30 * 100) / 100 : null,
              arrears: visible ? (f.arrears || { months: 0, owed: 0 }) : null,
              fresh: Number(f.fresh) || 0,
              freshUntilDay: Number(f.freshUntilDay) || 0,
              stationed: visible ? (f.stationed || {}) : {},
              hidden: !visible,
            };
          });
        })(),"""
lines[start:end+1] = new.split('\n')
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('势力负载已按身份过滤')
