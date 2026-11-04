import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("          .slice(0, 60);", "          .slice(0, 300);", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('地点上限 60 → 300')
