import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "          if (olds.length) bits.push(`你记得的旧事：${olds.join('；')}（提起来要照这些说，别说不记得）`);"
new = (
    "          if (olds.length) {\n"
    "            bits.push(`你记得的旧事：${olds.join('；')}（提起来要照这些说，别说不记得）`);\n"
    "            console.log(`[Memory] 旧事 ${olds.length} 条进上下文：${olds[0].slice(0, 24)}`);\n"
    "          }"
)
if old in s and '[Memory] 旧事' not in s:
    s = s.replace(old, new, 1)
    print('added memory log')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
