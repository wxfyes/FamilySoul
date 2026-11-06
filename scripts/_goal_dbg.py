import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      return sendJson(res, 200, { ok: true, tick, goalsInfo, day: world.clock?.day, hour: world.clock?.hour });"""
new = """      let dbg = null;
      try {
        const wa = Object.values(world.actors || {}).find((x) => x && x.name === '沈婉儿');
        const h = world.places?.[wa?.home];
        dbg = { home: wa?.home, homeExists: Boolean(h), roomKeys: Object.keys(h?.rooms || {}), hallId: h?.rooms?.hall?.id || null, gardenId: h?.rooms?.garden?.id || null };
      } catch { /* 忽略 */ }
      return sendJson(res, 200, { ok: true, tick, goalsInfo, dbg, day: world.clock?.day, hour: world.clock?.hour });"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加调试字段')
