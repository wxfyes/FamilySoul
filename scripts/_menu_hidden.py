import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            if (id === curId || !pl || !pl.name || pl.private) return false;"""
new = """            if (id === curId || !pl || !pl.name || pl.private || pl.hidden) return false;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('菜单跳过 hidden')
