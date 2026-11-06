import io
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("const num = (v) => {", "import { materializeRoom } from './residence.js';\n\nconst num = (v) => {", 1)
old = """    if (g.place && g.place !== a.location && hour <= num(g.due)) {"""
new = """    // 目标地点没展开/没写，就按他的身份给一处该去的地方
    if (!g.place) {
      const home = world.places?.[a.home];
      if (a.household && home?.rooms?.hall) g.place = home.rooms.hall.id;
      else if (a.household && home?.rooms?.garden) g.place = home.rooms.garden.id;
      else g.place = a.location || 'street';
    }
    if (g.place && String(g.place).includes('__') && !world.places?.[g.place]) {
      const [pid, key] = String(g.place).split('__');
      g.place = materializeRoom(world, pid, key) || g.place;
    }
    if (g.place && g.place !== a.location && hour <= num(g.due)) {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('目标地点兜底')
