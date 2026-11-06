import io
p = 'src/world/tick.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  // ── ④ 身份标签随日子变 + 街头摊子按点来去 ──"""
new = """  // ── ③.5 家眷白天会自己走动：院里转转、去花园、偶尔上街（不是锁在屋里）──
  try {
    const hNow = num(hour);
    if (hNow >= 9 && hNow <= 18) {
      for (const a of Object.values(world?.actors || {})) {
        if (!a || a.dead || a.jailed || a.away) continue;
        if (!a.household) continue;
        const home = world.places?.[a.home];
        if (!home || !home.rooms) continue;
        if (Math.random() > 0.35) continue;
        const keys = Object.keys(home.rooms).filter((k) => ['hall', 'garden', 'reception', 'shrine', 'front'].includes(k));
        const picks = ['hall', 'garden', 'reception'].filter((k) => home.rooms[k]);
        if (!picks.length) continue;
        const key = picks[Math.floor(Math.random() * picks.length)];
        const to = home.rooms[key].id;
        if (to && to !== a.location && world.places?.[to]) {
          const mv = moveActor(world, a.id, to, 'world', '自己走动');
          if (mv?.ok) a.activity = { text: '在府里走动', at: hNow, day: num(world.clock?.day) || 1 };
        }
      }
    }
  } catch { /* 忽略 */ }

  // ── ④ 身份标签随日子变 + 街头摊子按点来去 ──"""
if old in s and '家眷白天会自己走动' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 家眷白天自己走动')
