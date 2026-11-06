import io
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (!g.place) {
      const home = world.places?.[a.home];
      if (a.household && home?.rooms?.hall) g.place = home.rooms.hall.id;
      else if (a.household && home?.rooms?.garden) g.place = home.rooms.garden.id;
      else g.place = a.location || 'street';
    }"""
new = """    if (!g.place) {
      const home = world.places?.[a.home];
      if (a.household && home) {
        // 目标房间平时只记在账上，先展开再走（否则会算成"原地不动"）
        for (const key of ['hall', 'garden', 'shrine', 'account', 'reception']) {
          if (!home.rooms?.[key]) continue;
          const made = materializeRoom(world, home.id, key);
          if (made && world.places?.[made]) { g.place = made; break; }
        }
      }
      if (!g.place) g.place = a.location || 'street';
    }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('目标房间先展开')
