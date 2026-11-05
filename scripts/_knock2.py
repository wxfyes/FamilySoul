import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          const dest = world.places?.[target];
          const home = dest ? residenceOf(world, dest.id) : null;
          if (home && home.id !== target && String(home.owner || '') !== actorId) {"""
new = """          const dest = world.places?.[target];
          const home = dest ? residenceOf(world, dest.id) : null;
          const gateId0 = home?.rooms?.gate?.id || null;
          if (home && String(home.owner || '') !== actorId && target !== gateId0) {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 目标就是宅子本身时也叫门')
