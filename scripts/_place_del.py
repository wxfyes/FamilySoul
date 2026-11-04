import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 去掉屋名前的虚字
old = "      if (m1) roomName = m1[1] + m1[2];"
new = "      if (m1) roomName = (m1[1] + m1[2]).replace(/^[的了着个间]/, '');"
if old in s:
    s = s.replace(old, new, 1)
    print('① 去掉虚字')

# ② 加"删地点"管理接口
anchor = "    // 人间自愈：手动让天道安顿一次（诊断/验收用）"
block = """    // 删掉误立的地方，把人送回一处（管理用）
    if (req.method === 'POST' && pathname === '/api/admin/place/delete') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const id = String(body.id || '');
        const to = String(body.to || 'street');
        const world = loadState(DATA_DIR);
        if (!world.places?.[id]) return sendJson(res, 404, { ok: false, error: '没有这个地点' });
        const name = world.places[id].name;
        const back = world.places[to] ? to : 'street';
        for (const a of Object.values(world.actors || {})) {
          if (a && a.location === id) a.location = back;
        }
        delete world.places[id];
        if (world.dynamicPlaces) delete world.dynamicPlaces[id];
        for (const ap of world.appointments || []) if (ap && ap.place === id) delete ap.place;
        saveState(DATA_DIR, world);
        console.log(`[Place] 删掉「${name}」，人送回${world.places[back]?.name || back}`);
        return sendJson(res, 200, { ok: true, deleted: name, movedTo: world.places[back]?.name || back });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

"""
if '/api/admin/place/delete' not in s:
    s = s.replace(anchor, block + anchor, 1)
    print('② 加删地点接口')
io.open(p, 'w', encoding='utf-8').write(s)
print('done')
