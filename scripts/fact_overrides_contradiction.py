import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        if (!roleOk) {\n"
    "          reply = `${factLine}\\n${String(reply || '').trim()}`.trim();\n"
    "          console.log(`[Scene] 先给事实：${houseActor.name}·${houseActor.role || ''}`);\n"
    "        }"
)
new = (
    "        const contradicted = /(么？|么\\?|听说|提过一嘴|哪家|外头|不认识|不认得|从哪儿听来)/.test(String(reply || ''));\n"
    "        if (!roleOk && contradicted) {\n"
    "          // 模型把府里人当外人 → 只留事实，别让它继续编\n"
    "          reply = factLine;\n"
    "          console.log(`[Scene] 模型把${houseActor.name}当外人，已用事实覆盖`);\n"
    "        } else if (!roleOk) {\n"
    "          reply = `${factLine}\\n${String(reply || '').trim()}`.trim();\n"
    "          console.log(`[Scene] 先给事实：${houseActor.name}·${houseActor.role || ''}`);\n"
    "        }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: contradicted reply replaced by fact')
else:
    print('WARN: block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
