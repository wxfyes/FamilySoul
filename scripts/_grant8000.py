import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("const grant = 300;", "const grant = 8000;", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('启动本钱改为 8000')
