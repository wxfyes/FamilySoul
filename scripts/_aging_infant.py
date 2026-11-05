import io
p = 'src/world/aging.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    const age = num(a.age);
    if (!(age > 0)) continue;
    a.age = age + 1;"""
new = """    const age = num(a.age);
    if (!Number.isFinite(age)) continue;
    a.age = age + 1;   // 婴孩也要长（0 岁同样要长）"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('婴孩也长岁')
