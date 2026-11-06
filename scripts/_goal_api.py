import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { advanceWorldTick } from './world/tick.js';",
              "import { advanceWorldTick } from './world/tick.js';\nimport { pursueGoals, refreshGoals } from './world/goals.js';", 1)
old = """      const tick = advanceWorldTick(world, Number(world.clock?.hour) || 0);
      saveState(DATA_DIR, world);
      return sendJson(res, 200, { ok: true, tick, day: world.clock?.day, hour: world.clock?.hour });"""
new = """      let goalsInfo = null;
      let tick;
      try {
        const fresh = refreshGoals(world);
        const moved = pursueGoals(world);
        goalsInfo = { fresh, moved };
      } catch (e) { goalsInfo = { error: e.message }; }
      tick = advanceWorldTick(world, Number(world.clock?.hour) || 0);
      saveState(DATA_DIR, world);
      return sendJson(res, 200, { ok: true, tick, goalsInfo, day: world.clock?.day, hour: world.clock?.hour });"""
if old in s and 'goalsInfo' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('tick-run 直接推目标并回报')
