import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        const joined3 = kept3.join('').trim();\n"
    "        const reply = joined3 || '';"
)
if old in s:
    new = (
        "        const joined3 = kept3.join('').trim();\n"
        "        let final3 = joined3;\n"
        "        if (!final3) {\n"
        "          // 全被掐掉：说明点的人不在场 → 照实报他在哪\n"
        "          const named3 = Object.values(wLoc.actors || {}).find((a) => a && a.name && String(say || '').includes(a.name));\n"
        "          if (named3) {\n"
        "            const where3 = String(wLoc.places?.[named3.location]?.name || '别处');\n"
        "            const here3 = String(wLoc.places?.[locId2]?.name || '这里');\n"
        "            final3 = `【${here3}】：${named3.name}在「${where3}」，眼下不在这儿。`;\n"
        "            console.log(`[Scene] ${named3.name}不在场，照实报位置：${where3}`);\n"
        "          }\n"
        "        }\n"
        "        reply = final3;"
    )
    s = s.replace(old, new, 1)
    print('patched: absent fallback inside off-scene filter')
else:
    print('WARN: joined3 block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
