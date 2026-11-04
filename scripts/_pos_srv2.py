import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
pairs = [
 ("            actor.location = pid;", "            moveActor(world, actor.id, pid, 'ui', '界面移动');"),
 ("        world.actors[id].location = to;", "        moveActor(world, id, to, 'world', '拖去牢里');"),
 ("          if (a.location === 'yamen') a.location = a.home || 'street';",
  "          if (a.location === 'yamen') moveActor(world, a.id, a.home || 'street', 'world', '下值回家');"),
 ("                if (pid && world.places?.[pid]) { a.location = pid; changed.location = world.places[pid].name; }",
  "                if (pid && world.places?.[pid]) { moveActor(world, a.id, pid, 'ui', '管理改位'); changed.location = world.places[pid].name; }"),
]
n=0
for old,new in pairs:
    if old in s:
        s = s.replace(old,new); n+=1
io.open(p,'w',encoding='utf-8').write(s)
print('替换', n)
