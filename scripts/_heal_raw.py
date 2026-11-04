import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const r = applyPlacements(world, text);
        world.flags = world.flags || {};
        world.flags.lastSelfHealDayHour = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, healed: true, changed: r.changed, notes: (r.notes || []).slice(0, 20), error: r.error || null });"""
new = """        const r = applyPlacements(world, text);
        world.flags = world.flags || {};
        world.flags.lastSelfHealDayHour = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, {
          ok: true, healed: true, changed: r.changed,
          notes: (r.notes || []).slice(0, 20), error: r.error || null,
          raw: String(text || '').slice(0, 400),
        });"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已加 raw 回显')
