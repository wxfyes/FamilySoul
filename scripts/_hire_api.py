import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 删掉误记的产业（管理用）：按名字"
block = """    // 雇一个人进某处产业（管理用 / 人工纠错）：{prop, name, role}
    if (req.method === 'POST' && pathname === '/api/admin/staff/hire') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const propName = String(body.prop || '').trim();
        const whoName = String(body.name || '').trim();
        const role = String(body.role || '伙计').trim().slice(0, 8);
        const world = loadState(DATA_DIR);
        const prop = (world.assets?.properties || []).find((x) => x && String(x.name).includes(propName));
        if (!prop) return sendJson(res, 404, { ok: false, error: '没这个产业' });
        if (!prop.placeId || !world.places?.[prop.placeId]) return sendJson(res, 400, { ok: false, error: '这处产业还没挂地点' });
        if (!/^[\\u4e00-\\u9fa5]{2,4}$/.test(whoName)) return sendJson(res, 400, { ok: false, error: '名字不像人名' });

        let a = Object.values(world.actors || {}).find((x) => x && x.name === whoName);
        if (!a) {
          const id = `npc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          a = { id, name: whoName, role, gender: 'unknown',
            home: prop.placeId, work: prop.placeId, location: prop.placeId,
            money: 0, relations: {}, schedule: [], origin: 'hired', createdDay: world.clock?.day || 1 };
          world.actors[id] = a;
        } else {
          moveActor(world, a.id, prop.placeId, 'ui', '到岗');
        }
        prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
        if (!prop.staffIds.includes(a.id)) prop.staffIds.push(a.id);
        prop.staff = prop.staffIds.length;
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, hired: a.name, role, prop: prop.name, staff: prop.staff });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

""" + anchor
if '/api/admin/staff/hire' not in s:
    s = s.replace(anchor, block, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('已加雇人管理接口')
