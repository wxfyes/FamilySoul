import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          for (const g of goers) {
            const back = g.quarters || g.home;
            if (!back || !wD.places?.[back] || back === meD.location) continue;"""
new = """          for (const g of goers) {
            let back = g.quarters || g.home;
            const bad = !back || !wD.places?.[back] || back === 'street' || back === meD.location;
            if (bad) {
              try { back = ensureDwelling(wD, g.id, g.name, 'street'); } catch { back = null; }
            }
            if (!back || !wD.places?.[back] || back === meD.location) continue;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 没住处的人先安置再送走')
