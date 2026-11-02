import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "  if (req.method === 'GET' && pathname === '/api/who') {"
new = (
    "  if (req.method === 'GET' && (pathname === '/api/who' || pathname === '/dsh-surfcore/pet-api/api/who' || pathname === '/dsh-surfcore/pet-api/who')) {"
)
if old in s:
    s = s.replace(old, new)
    print('patched: /api/who accepts app prefix')
else:
    print('WARN: /api/who route not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
