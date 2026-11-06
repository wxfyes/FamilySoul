import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (actor.jailed) continue;"""
new = """        if (actor.jailed) continue;
        // 刚被主人请走的人，几个时辰内不许自己回来
        if (actor.dismissedUntil) {
          const d = actor.dismissedUntil;
          if (Number(d.day) === (Number(world.clock?.day) || 1) && Number(d.hour) > (Number(world.clock?.hour) || 0)) continue;
          delete actor.dismissedUntil;
        }"""
if old in s and 'dismissedUntil' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 日程尊重送客冷却')
