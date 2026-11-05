import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
# 把此间院子信息并进 /api/me（新路由在某些分支里进不去，走负载最稳）
old = """        goods: goodsSnapshot(world),"""
new = """        goods: goodsSnapshot(world),
        room: (() => {
          try {
            const meId = actorId || 'husband';
            const meNow = world.actors?.[meId] || world.actors?.husband;
            return describeRoom(world, meNow?.location) || null;
          } catch { return null; }
        })(),"""
if old in s and 'room: (() => {' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① /api/me 带 room')
