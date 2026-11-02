import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        .filter((a) => a && !a.dead && a.id !== actorId && a.id !== 'husband')"
new = "        .filter((a) => a && !a.dead && a.id !== actorId)"
if old in s:
    s = s.replace(old, new)
    print('patched: include husband in who')
else:
    print('WARN: who filter not found')

# 相公本人也算真人
old2 = "      const humanActors = new Set(Object.values(cfg || {}).map((x) => x?.actor).filter(Boolean));"
new2 = "      const humanActors = new Set(Object.values(cfg || {}).map((x) => x?.actor).filter(Boolean));\n      humanActors.add('husband');"
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: husband marked human')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
