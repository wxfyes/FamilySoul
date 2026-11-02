import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 丈夫身份要说清
old = "              facts: npcFacts.concat([`你和${mePost?.name || '她'}的关系：${npc.role || '相识'}`]),"
new = (
    "              facts: npcFacts.concat([\n"
    "                npc.home && mePost?.home && npc.home === mePost.home && npc.gender === 'male'\n"
    "                  ? `你是${mePost?.name || '她'}的丈夫，说话要像当家的：亲近但实在，不许说「偷来的半日闲」这种外人才说的话`\n"
    "                  : `你和${mePost?.name || '她'}的关系：${npc.role || '相识'}`,\n"
    "              ]),"
)
if old in s:
    s = s.replace(old, new)
    print('patched: husband relation hint')
else:
    print('WARN: npc facts line not found')

# ② 去掉残留的"没人接话"
old2 = "              reply = `${npLine}\\n${String(reply).split('\\n').filter((x) => !/没人应声/.test(x)).join('\\n')}`.trim();"
new2 = "              reply = `${npLine}\\n${String(reply).split('\\n').filter((x) => !/没人应声|没人接话/.test(x)).join('\\n')}`.trim();"
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: strip empty-narration line')
else:
    print('WARN: prepend line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
