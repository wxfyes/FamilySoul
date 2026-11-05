import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            home: a.home || null,
            homeName: a.home ? (world.places?.[a.home]?.name || '') : '',"""
new = """            home: a.home || null,
            homeName: a.home ? (world.places?.[a.home]?.name || '') : '',
            duty: a.duty || null,"""
if old in s and 'duty: a.duty || null' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 后台世界面板带差事')
