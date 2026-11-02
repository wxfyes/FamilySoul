import io

# ① spawn 时清洗名字：像句子的名字一律改用行当
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "      } else if (kind === 'spawn') {\n"
    "        const name = String(args.name || '').trim();\n"
    "        if (!name) continue;"
)
new = (
    "      } else if (kind === 'spawn') {\n"
    "        let name = String(args.name || '').trim();\n"
    "        if (!name) continue;\n"
    "        // 名字不能像一句话（\"先去请个\"\"是新请的\"这种）\n"
    "        const looksLikeSentence = /(的|了|是|请|个|去|来|叫|新|这|那|把|被|给|要|得|着|过|您|你|我|他|她)/.test(name) || name.length > 4;\n"
    "        if (looksLikeSentence) {\n"
    "          const roleWord = String(args.role || '').trim();\n"
    "          name = roleWord && roleWord.length <= 4 && !/的|了|是/.test(roleWord) ? roleWord : '城中人';\n"
    "        }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: spawn name sanitation')
else:
    print('WARN: spawn block not found')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 管理端：删掉一个 NPC
p2 = 'src/server.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.26f 删除一个 NPC POST /api/admin/actor/delete {id}\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/actor/delete') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const world = peek(DATA_DIR);\n"
    "        const id = String(body.id || '');\n"
    "        if (!id || id === 'husband') return sendJson(res, 400, { ok: false, error: '不能删这个' });\n"
    "        const a = world.actors?.[id];\n"
    "        if (!a) return sendJson(res, 404, { ok: false, error: '没有这个人' });\n"
    "        delete world.actors[id];\n"
    "        if (world.npcArcs) delete world.npcArcs[id];\n"
    "        saveState(DATA_DIR, world);\n"
    "        console.log(`[Actor] 已删除 ${a.name}(${id})`);\n"
    "        return sendJson(res, 200, { ok: true, name: a.name });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s2 and '/api/admin/actor/delete' not in s2:
    s2 = s2.replace(anchor, inject, 1)
    print('added actor delete endpoint')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
