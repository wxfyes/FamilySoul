import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        if (!roleOk && contradicted) {\n"
    "          // 模型把府里人当外人 → 只留事实，别让它继续编\n"
    "          reply = factLine;\n"
    "          console.log(`[Scene] 模型把${houseActor.name}当外人，已用事实覆盖`);\n"
    "        }"
)
new = (
    "        if (!roleOk && contradicted) {\n"
    "          // 模型把府里人当外人 → 换成她本人口吻的更正\n"
    "          const mSpeak = String(reply || '').match(/^【([^】\\n]{1,12})】/);\n"
    "          const speaker = mSpeak ? mSpeak[1] : '府中';\n"
    "          const core = `${houseActor.name}是${houseActor.role || '府里人'}，就住在「${whereH}」`;\n"
    "          reply = `【${speaker}】：（一时语塞）妾身糊涂了——${core}。`;\n"
    "          console.log(`[Scene] 模型把${houseActor.name}当外人，已改成更正口吻`);\n"
    "        }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: correction in character')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
