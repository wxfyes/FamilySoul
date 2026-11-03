import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        const joined = kept.join('').trim();\n"
    "        if (joined) reply = joined;"
)
new = (
    "        const joined = kept.join('').trim();\n"
    "        if (joined) reply = joined;\n"
    "        else {\n"
    "          // 全被掐掉：说明她/他不在场，就照实说人在哪，别只剩省略号\n"
    "          const abs = namedHere[0];\n"
    "          const where = String(wEnd.places?.[abs.location]?.name || '别处');\n"
    "          const here = String(wEnd.places?.[this._viewerActorId ? wEnd.actors?.[this._viewerActorId]?.location : wEnd.actors?.husband?.location]?.name || '这里');\n"
    "          reply = `【${here}】：${abs.name}在「${where}」，眼下不在这儿。`;\n"
    "          console.log(`[Scene] ${abs.name}不在场，照实报位置：${where}`);\n"
    "        }"
)
if old in s and '全被掐掉：说明' not in s:
    s = s.replace(old, new, 1)
    print('patched: absent speaker answers with location')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
