import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (req.method === 'GET' && pathname === '/api/world/room') {"""
new = """    if (req.method === 'GET' && matchRoute('/world/room')) {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 路由改用 matchRoute')
