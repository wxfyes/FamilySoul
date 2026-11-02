import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        moved.push('相公');"
new = "        moved.push(String(world.actors?.[selfId]?.name || '相公'));"
if old in s:
    s = s.replace(old, new, 1)
    print('patched: scene sync logs real actor name')
else:
    print('WARN: moved.push 相公 not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
