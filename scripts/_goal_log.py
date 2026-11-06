import io
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const mv = moveActor(world, a.id, g.place, 'world', '办自己的事');"""
new = """      const mv = moveActor(world, a.id, g.place, 'world', '办自己的事');
      if (!mv?.ok) console.log(`[Goal] ${a.name} 没走成：${mv?.error || '未知'}（去${g.place}）`);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加失败日志')
