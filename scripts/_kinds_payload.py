import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
# 两处 factions 负载都补 kinds
s = s.replace("          gear: f.gear || {}, fresh: Number(f.fresh) || 0, freshUntilDay: Number(f.freshUntilDay) || 0,",
              "          gear: f.gear || {}, kinds: f.kinds || {}, fresh: Number(f.fresh) || 0, freshUntilDay: Number(f.freshUntilDay) || 0,")
s = s.replace("          cities: (f.cities || []).slice(0, 12),\n          gear: f.gear || {},\n          monthlyPay: Math.round((Number(f.troops) || 0) * 1.0 * 100) / 100,",
              "          cities: (f.cities || []).slice(0, 12),\n          gear: f.gear || {},\n          kinds: f.kinds || {},\n          monthlyPay: Math.round((Number(f.troops) || 0) * 1.0 * 100) / 100,")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('负载补 kinds')
