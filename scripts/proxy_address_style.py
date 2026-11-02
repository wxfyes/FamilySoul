import io

p = 'src/world/proxy-actor.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    '5. 不许用「一时恍惚」「认错人」「你与她太像」这类话搪塞。',"
new = (
    "    '5. 不许用「一时恍惚」「认错人」「你与她太像」这类话搪塞。',\n"
    "    '6. 你与她是相好，称呼她名字（或娘子），不许用「姑娘」「客官」这种生分称呼。',\n"
    "    '7. 她问「你答应过我什么」时，必须把事实清单里每一条「许下过」的都逐条说清楚，不许只挑一条。',\n"
)
if old in s:
    s = s.replace(old, new)
    print('patched: address + enumerate promises')
else:
    print('WARN: rule 5 not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
