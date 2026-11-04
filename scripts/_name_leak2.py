import io
# 老约定里 name 存的就是 id：读的时候按名字→id→name 三级兜底
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            who: (ap.actorId && world.actors?.[ap.actorId]?.name) || ap.name || '',"""
new = """            who: (() => {
              const byId = ap.actorId ? world.actors?.[ap.actorId]?.name : null;
              if (byId) return byId;
              const rawName = String(ap.name || '');
              // 老数据把 id 当名字存进来了：能对上人就用真名
              const byName = world.actors?.[rawName]?.name;
              if (byName) return byName;
              const hit = Object.values(world.actors || {}).find((a) => a && a.name === rawName);
              return hit?.name || rawName;
            })(),"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('约定显示加三级兜底')
