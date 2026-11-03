import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.26k 记忆列表 GET /api/admin/memories\n"
    "    if (req.method === 'GET' && pathname === '/api/admin/memories') {\n"
    "      try {\n"
    "        const world = peek(DATA_DIR);\n"
    "        return sendJson(res, 200, { ok: true, memories: (world.memories || []).map((m) => ({ text: m.text, about: m.about || [], visible: m.visible || '', day: m.day })) });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s and '/api/admin/memories' not in s:
    s = s.replace(anchor, inject, 1)
    print('added memories list')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
