import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "      saveState(DATA_DIR, w3);\n      console.log(`[Court] 判案"
new = (
    "      // 退堂：没下狱的人各回各家，别一直杵在衙门\n"
    "      try {\n"
    "        for (const pid of [cc.whoId, cc.againstId]) {\n"
    "          const a = w3.actors?.[pid];\n"
    "          if (!a || pid === 'husband') continue;\n"
    "          if (a.jailed) continue;\n"
    "          if (a.location === 'yamen') a.location = a.home || 'street';\n"
    "        }\n"
    "      } catch { /* 忽略 */ }\n\n"
    "      saveState(DATA_DIR, w3);\n      console.log(`[Court] 判案"
)
if old in s and '退堂：没下狱的人各回各家' not in s:
    s = s.replace(old, new, 1)
    print('patched: parties go home after verdict')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
