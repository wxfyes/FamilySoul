import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
pairs = [
 ("      a.location = a.home || 'street';\n      delete a.jailed;",
  "      moveActor(world, a.id, a.home || 'street', 'world', '刑满');\n      delete a.jailed;"),
 ("      if (a.location !== 'academy') a.location = 'academy';",
  "      if (a.location !== 'academy') moveActor(world, a.id, 'academy', 'world', '上学');"),
 ("      a.location = home;\n      events.push(",
  "      moveActor(world, a.id, home, 'world', '天黑回家');\n      events.push("),
]
n=0
for old,new in pairs:
    if old in s:
        s=s.replace(old,new); n+=1
io.open(p,'w',encoding='utf-8-sig').write(s)
print('替换', n, '处')
