import io

p = 'src/world/proxy-actor.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    '7. 她问「你答应过我什么」时，必须把事实清单里每一条「许下过」的都逐条说清楚，不许只挑一条。',"
new = (
    "    '7. 她问「你答应过我什么」时，必须把事实清单里每一条「许下过」的都逐条说清楚，不许只挑一条。',\n"
    "    '8. 说借款必须写清方向：用「我借给你X两」「你欠我X两」「你该还我」；不许用「借你」「借我」这种分不清的说法。',\n"
)
if old in s:
    s = s.replace(old, new)
    print('patched: explicit loan phrasing rule')
else:
    print('WARN: rule 7 not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
