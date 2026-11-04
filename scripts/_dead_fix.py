import io
p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (a.location && !world.places?.[a.location]) { a.location = 'street'; fixed += 1; }"""
new = """    if (a.dead) { if (a.location) { delete a.location; fixed += 1; } continue; }
    if (a.location && !world.places?.[a.location]) { a.location = 'street'; fixed += 1; }"""
if old in s and "a.dead) { if (a.location)" not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('死人一律清行踪（规则级兜底）')
