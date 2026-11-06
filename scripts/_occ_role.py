import io
p = 'src/world/occupation.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "      if (String(a.id).startsWith('usr_') || a.stall || a.household === false && !a.role) a.role = next;"
new = "      if (String(a.id).startsWith('usr_') || a.id === 'husband' || a.stall) a.role = next;"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 玩家与摊贩的 role 跟着 title 变')
