import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            const verdict = knock(world, actorId, home.id);
            if (!verdict.allowed) {
              knockLine = `（${verdict.reason}）`;
              target = world.places?.[home.id]?.rooms?.gate?.id || home.id;
            } else {"""
new = """            const verdict = knock(world, actorId, home.id);
            if (!verdict.allowed) {
              // 门房拦住：直接落在大门，把门房的话原样回给相公
              const gateId = world.places?.[home.id]?.rooms?.gate?.id || home.id;
              try { moveActor(world, actorId, gateId, 'world', '叩门被拦'); saveState(DATA_DIR, world); } catch { /* 忽略 */ }
              const gateName = world.places?.[gateId]?.name || '';
              return sendJson(res, 200, {
                ok: true,
                applied: false,
                denied: true,
                place: gateName,
                line: `（${verdict.reason}）你到了「${gateName}」，门房没让进。`,
              });
            } else {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 被拦直接返回门房的话')
