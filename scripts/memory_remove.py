import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.26j 删记忆 POST /api/admin/memory/remove {text}\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/memory/remove') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const world = peek(DATA_DIR);\n"
    "        const text = String(body.text || '').slice(0, 60);\n"
    "        const before = (world.memories || []).length;\n"
    "        world.memories = (world.memories || []).filter((m) => !String(m?.text || '').includes(text));\n"
    "        saveState(DATA_DIR, world);\n"
    "        const removed = before - world.memories.length;\n"
    "        console.log(`[Memory] 删除 ${removed} 条：${text}`);\n"
    "        return sendJson(res, 200, { ok: true, removed });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s and '/api/admin/memory/remove' not in s:
    s = s.replace(anchor, inject, 1)
    print('added memory remove endpoint')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
