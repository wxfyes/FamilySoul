import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "          for (const npc of namedPresent.slice(0, 2)) {"
new = (
    "          console.log('[Proxy] 点名候选 ' + namedPresent.length + ' 人：' + namedPresent.map((x) => x.name).join('、'));\n"
    "          for (const npc of namedPresent.slice(0, 2)) {"
)
if old in s and '点名候选' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('added debug log')
else:
    print('skip')
