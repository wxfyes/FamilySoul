import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.26e 补一条线索 POST /api/admin/clue {text, owner, source}\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/clue') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const world = peek(DATA_DIR);\n"
    "        const text = String(body.text || '').slice(0, 80);\n"
    "        if (!text) return sendJson(res, 400, { ok: false, error: '缺 text' });\n"
    "        world.clues = Array.isArray(world.clues) ? world.clues : [];\n"
    "        if (world.clues.some((c) => String(c?.text || '') === text)) {\n"
    "          return sendJson(res, 200, { ok: true, duplicated: true });\n"
    "        }\n"
    "        world.clues.push({\n"
    "          text,\n"
    "          day: Number(world.clock?.day) || 1,\n"
    "          source: String(body.source || '街面风声').slice(0, 20),\n"
    "          owner: String(body.owner || 'husband'),\n"
    "        });\n"
    "        saveState(DATA_DIR, world);\n"
    "        console.log(`[Clue] 补一条：${text.slice(0, 20)}（owner=${String(body.owner || 'husband')}）`);\n"
    "        return sendJson(res, 200, { ok: true });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s and '/api/admin/clue' not in s:
    s = s.replace(anchor, inject, 1)
    print('added clue endpoint')
else:
    print('WARN: anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
