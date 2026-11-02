import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        const movedNow = Boolean(summonResult && ((summonResult.moved || []).length > 0 || summonResult.left));"
new = "        const movedNow = Boolean(typeof summonResult !== 'undefined' && summonResult && ((summonResult.moved || []).length > 0 || summonResult.left));"
if old in s:
    s = s.replace(old, new)
    print('patched: summonResult guard')
else:
    print('WARN: movedNow line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
