import io
p = 'src/world/privacy.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  return access.startsWith('family') || access === 'servant_utility';"""
new = """  return access.startsWith('family') || access === 'servant_utility' || access === 'staff_only' || access === 'guest_room';"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('② 后厨/库房/雅间算非公开')
