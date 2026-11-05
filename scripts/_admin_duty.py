import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        id: a.id, name: a.name, role: a.role, gender: a.gender, place: world.places?.[a.location]?.name || a.location,"""
new = """        id: a.id, name: a.name, role: a.role, gender: a.gender, place: world.places?.[a.location]?.name || a.location,
        duty: a.duty || null, home: a.home || null,"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 后台可看差事')
