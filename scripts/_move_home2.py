import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (!a.home || a.home === 'inn') a.home = pid;"""
new = """        if (!a.home || a.home === 'inn') a.home = pid;
        if (a.location === 'inn') a.location = pid;   // 已有院子的，也从客栈搬回家"""
if old in s and '已有院子的，也从客栈搬回家' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('已有院子的也搬回家')
