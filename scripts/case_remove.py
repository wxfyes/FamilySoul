import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.26i 删案 POST /api/admin/case/remove {id}\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/case/remove') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const world = peek(DATA_DIR);\n"
    "        const id = String(body.id || '');\n"
    "        const before = (world.cases || []).length;\n"
    "        world.cases = (world.cases || []).filter((c) => c && c.id !== id);\n"
    "        saveState(DATA_DIR, world);\n"
    "        const removed = before - world.cases.length;\n"
    "        console.log(`[Case] 删除案卷 ${id}（${removed}）`);\n"
    "        return sendJson(res, 200, { ok: true, removed });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s and '/api/admin/case/remove' not in s:
    s = s.replace(anchor, inject, 1)
    print('added case remove endpoint')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
