import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const world = loadState(DATA_DIR);
      const keep = new Set();
      const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.name);"""
new = """      // 用活的世界对象（peek 缓存）改名，别改完文件、线上还是旧名
      const world = peek(DATA_DIR);
      const keep = new Set();
      const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.name);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('改用 peek')
