import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        if (bondLines.length) bits.push(`他们彼此：${bondLines.join('；')}（他们之间有自己的情分和恩怨，不只围着你转）`);"
new = (
    "        if (bondLines.length) {\n"
    "          bits.push(`他们彼此：${bondLines.join('；')}（他们之间有自己的情分和恩怨，不只围着你转）`);\n"
    "          console.log(`[Bonds] 在场关系 ${bondLines.length} 条：${bondLines.slice(0, 3).join('；')}`);\n"
    "        }"
)
if old in s and '[Bonds] 在场关系' not in s:
    s = s.replace(old, new, 1)
    print('added bonds debug log')
else:
    print('skip')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
