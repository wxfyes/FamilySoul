import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
pairs = [
    # 开房付款后进房（界面）
    ("        me.location = roomId;", "        moveActor(world, me.id, roomId, 'ui', '开房');"),
    ("            a.location = roomId;", "            moveActor(world, a.id, roomId, 'world', '同行进房');"),
    # 赴约：约定 / 承诺（界面）
    ("              me.location = pid;", "              moveActor(world, me.id, pid, 'ui', '赴约');"),
    ("                me.location = pid2;", "                moveActor(world, me.id, pid2, 'ui', '去办差事');"),
    # 找人"过去"（界面）
    ("        me.location = pid;", "        moveActor(world, me.id, pid, 'ui', '界面移动');"),
    # 删地点时把人送回
    ("          if (a && a.location === id) a.location = back;", "          if (a && a.location === id) moveActor(world, a.id, back, 'world', '地点撤销');"),
    # 改人物接口里的位置
    ("          if (world.places?.[pid]) { a.location = pid; changed.location = world.places[pid].name; }",
     "          if (world.places?.[pid]) { moveActor(world, a.id, pid, 'ui', '管理改位'); changed.location = world.places[pid].name; }"),
]
n = 0
for old, new in pairs:
    if old in s:
        s = s.replace(old, new)
        n += 1
io.open(p, 'w', encoding='utf-8').write(s)
print('server.js 替换', n, '处')
