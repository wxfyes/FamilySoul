import io
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      g.place = materializeRoom(world, pid, key) || g.place;
    }"""
new = """      const made = materializeRoom(world, pid, key);
      g.place = (made && world.places?.[made]) ? made : null;
    }
    if (!g.place || !world.places?.[g.place]) {
      const home = world.places?.[a.home];
      g.place = home?.rooms?.hall?.id || home?.rooms?.garden?.id || 'street';
    }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('地点不存在则兜底')
