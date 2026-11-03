import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "      const named = Object.values(wM.actors || {}).filter((a) => {\n"
    "        if (!a || a.dead || !a.name || a.id === this._viewerActorId) return false;\n"
    "        if (a.location !== meM?.location) return false;\n"
    "        const short = a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
    "        return saidM.includes(a.name) || (short && saidM.includes(short));\n"
    "      }).slice(0, 3);"
)
new = (
    "      const namedByText = Object.values(wM.actors || {}).filter((a) => {\n"
    "        if (!a || a.dead || !a.name || a.id === this._viewerActorId) return false;\n"
    "        if (a.location !== meM?.location) return false;\n"
    "        const short = a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
    "        return saidM.includes(a.name) || (short && saidM.includes(short));\n"
    "      });\n"
    "      // 说\"你们两个/你们俩/都\"这种，就把在场的几位都算上\n"
    "      const plural = /(你们两个|你们俩|你俩|你们两|两位|都|大家|一起)/.test(saidM);\n"
    "      const presentAll = Object.values(wM.actors || {})\n"
    "        .filter((a) => a && !a.dead && a.name && a.id !== this._viewerActorId && a.id !== 'husband' && a.location === meM?.location)\n"
    "        .sort((x, y) => (Number(y.relations?.husband?.trust) || 0) - (Number(x.relations?.husband?.trust) || 0));\n"
    "      const named = (namedByText.length ? namedByText : (plural ? presentAll.slice(0, 2) : [])).slice(0, 3);"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: plural forms trigger multi-speaker')
else:
    print('WARN: named block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
