import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        arc: arc\n          ? {"
new = (
    "        decrees: (world.court?.decisions || []).slice(-3).map((d) => ({ day: d.day, text: d.text })),\n"
    "        arc: arc\n          ? {"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: decrees in /api/me')
else:
    print('WARN: anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
