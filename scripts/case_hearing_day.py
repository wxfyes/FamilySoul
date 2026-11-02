import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        claim: String(d?.crime || '犯了事').slice(0, 20),\n        witnesses: [], status: 'filed', verdict: null, petty: true,"
new = "        claim: String(d?.crime || '犯了事').slice(0, 20),\n        witnesses: [], status: 'summoned', hearDay: (Number(w2.clock?.day) || 1) + 1, hearHour: 9, verdict: null, petty: true,"
if old in s:
    s = s.replace(old, new, 1)
    print('patched: generated cases get a hearing day')
else:
    print('WARN: case creation not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
