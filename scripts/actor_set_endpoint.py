import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.32 重置某个世界人物的线 POST /api/admin/actor/reset"
inject = """    // 9.31b 改世界人物属性 POST /api/admin/actor/set {id, age, gender, role, money, name}
    if (req.method === 'POST' && pathname === '/api/admin/actor/set') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const a = world.actors?.[String(body.id || '')];
        if (!a) return sendJson(res, 404, { ok: false, error: '没有这个人' });
        const changed = {};
        if (body.name != null) { a.name = String(body.name).slice(0, 12); changed.name = a.name; }
        if (body.age != null) { a.age = Math.max(1, Math.min(120, Number(body.age) || 1)); changed.age = a.age; }
        if (body.gender != null) { a.gender = String(body.gender) === 'male' ? 'male' : 'female'; changed.gender = a.gender; }
        if (body.role != null) { a.role = String(body.role).slice(0, 24); changed.role = a.role; }
        if (body.money != null) { a.money = Math.max(0, Number(body.money) || 0); changed.money = a.money; }
        if (body.location != null) {
          const pid = String(body.location);
          if (world.places?.[pid]) { a.location = pid; changed.location = world.places[pid].name; }
        }
        saveState(DATA_DIR, world);
        console.log(`[Admin] 改人物：${a.name} ${JSON.stringify(changed)}`);
        return sendJson(res, 200, { ok: true, actor: { id: a.id, name: a.name, age: a.age, gender: a.gender, role: a.role, money: a.money } });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

"""
if '/api/admin/actor/set' not in s:
    s = s.replace(anchor, inject + anchor, 1)
    print('已加 /api/admin/actor/set')
io.open(p, 'w', encoding='utf-8').write(s)
print('done')
