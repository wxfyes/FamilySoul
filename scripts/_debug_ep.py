import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 6. 获取运行日志 GET /api/admin/logs"
block = '''    // 诊断：宅院状态（临时）
    if (req.method === 'GET' && pathname === '/api/admin/places-debug') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '令牌无效' });
        const world = loadState(DATA_DIR);
        const root = world.places?.husband_room || {};
        return sendJson(res, 200, {
          ok: true,
          places: Object.keys(world.places || {}).length,
          husName: root.name || null,
          residence: Boolean(root.residence),
          grade: root.grade || null,
          rooms: Object.keys(root.rooms || {}).length,
          roomKeys: Object.keys(root.rooms || {}).slice(0, 10),
          roomPlaces: Object.values(root.rooms || {}).map((r) => ({ id: r.id, exists: Boolean(world.places?.[r.id]), name: world.places?.[r.id]?.name })),
          exits: (root.exits || []).slice(0, 12),
          sweepDay: world.flags?.residenceSweptDay || null,
          sweepVer: world.flags?.residenceBuildVersion || null,
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

''' + anchor
if '/api/admin/places-debug' not in s:
    s = s.replace(anchor, block, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加诊断接口')
