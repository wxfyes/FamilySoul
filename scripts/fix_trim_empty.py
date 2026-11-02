import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        if (kept3.length && kept3.join('').trim()) reply = kept3.join('').trim();\n"
)
new = (
    "        const joined3 = kept3.join('').trim();\n"
    "        reply = joined3 || '';\n"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: empty after trim clears reply')
else:
    print('WARN: anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
