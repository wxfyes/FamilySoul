import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace('            let back = a.home || a.quarters;   // 回房优先回自己的住处，不是当差的门房', '            let back = a.home || a.quarters;   // 回房优先回自己的住处，不是当差的门房')
s = s.replace('            let back = a.quarters || a.home;', '            let back = a.home || a.quarters;')
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('back home 优先')
