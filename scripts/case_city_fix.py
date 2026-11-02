import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        day: w2.clock.day, hour: w2.clock.hour, city: pend.city,"
new = (
    "        day: w2.clock.day, hour: w2.clock.hour,\n"
    "        // 地点跟被告实际所在城走，别张冠李戴\n"
    "        city: (() => {\n"
    "          const pl = w2.places?.[culprit.location]?.name || '';\n"
    "          const parts = String(pl).split('·');\n"
    "          const hit = parts.find((p) => /府|州|县/.test(p));\n"
    "          return hit || pend.city;\n"
    "        })(),"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: case city follows culprit')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
