import io

p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

idx = None
for i, line in enumerate(lines):
    if line.strip() == "// 9.27 三道自检 GET /api/admin/audit":
        idx = i
        break

if idx is None:
    print('WARN: anchor line not found')
else:
    block = [
        "    // 9.26k 记忆列表 GET /api/admin/memories",
        "    if (req.method === 'GET' && pathname === '/api/admin/memories') {",
        "      try {",
        "        const world = peek(DATA_DIR);",
        "        return sendJson(res, 200, { ok: true, memories: (world.memories || []).map((m) => ({ text: m.text, about: m.about || [], visible: m.visible || '', day: m.day })) });",
        "      } catch (err) {",
        "        return sendJson(res, 500, { ok: false, error: err.message });",
        "      }",
        "    }",
        "",
    ]
    lines = lines[:idx] + block + lines[idx:]
    print('inserted memories route')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('ok')
