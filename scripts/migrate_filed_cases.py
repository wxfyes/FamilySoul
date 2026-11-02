import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    if (!c || c.status !== 'summoned') continue;"
new = (
    "    if (!c) continue;\n"
    "    // 老案子（只有 filed）补上开庭日，别永远卡着\n"
    "    if (c.status === 'filed') {\n"
    "      c.status = 'summoned';\n"
    "      if (!Number(c.hearDay)) c.hearDay = day;\n"
    "      if (!Number(c.hearHour)) c.hearHour = 9;\n"
    "    }\n"
    "    if (c.status !== 'summoned') continue;"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: migrate filed cases to summoned')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
