import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const target = String(body.place || '').trim();
        if (!target) return sendJson(res, 400, { ok: false, error: '没说要哪儿' });
        const world = loadState(DATA_DIR);"""
new = """        let target = String(body.place || '').trim();
        if (!target) return sendJson(res, 400, { ok: false, error: '没说要哪儿' });
        const world = loadState(DATA_DIR);
        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进
        {
          const person = Object.values(world.actors || {}).find(
            (a) => a && !a.dead && a.name && (a.name === target || target.includes(a.name)),
          );
          if (person && world.places?.[person.location] && person.name !== (String((world.actors?.[actorId] || world.actors?.husband)?.name || ''))) {
            target = person.location;
          }
        }"""
if old in s and '先换成他此刻所在的地方' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① go：人名先转地点')
