import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "            let back = a.quarters || a.home;"
new = "            let back = a.home || a.quarters;   // 回房优先回自己的住处，不是当差的门房"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('回房优先自家住处')
