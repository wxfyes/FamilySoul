import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "      if (!reply) reply = '……';"
new = (
    "      if (!reply) {\n"
    "        const wHome = loadState(this.dataDir);\n"
    "        const pNow = String(wHome.places?.[wHome.actors?.husband?.location]?.name || '');\n"
    "        reply = engineMovedHusband && pNow ? `【${pNow}】：（你到了${pNow}。）` : '……';\n"
    "      }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: empty reply becomes arrival narration')
else:
    print('WARN: empty reply line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
