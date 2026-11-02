import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.26g 把某人挪到某处（没有就建）POST /api/admin/actor/move {id, place}\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/actor/move') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const world = peek(DATA_DIR);\n"
    "        const id = String(body.id || '');\n"
    "        const placeName = String(body.place || '').trim().slice(0, 20);\n"
    "        const actor = world.actors?.[id];\n"
    "        if (!actor || !placeName) return sendJson(res, 400, { ok: false, error: '参数不全' });\n"
    "        world.places = world.places || {};\n"
    "        let pid = Object.keys(world.places).find((k) => world.places[k]?.name === placeName);\n"
    "        if (!pid) {\n"
    "          world.flags = world.flags || {};\n"
    "          world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;\n"
    "          pid = `place_${world.flags.placeSeq}`;\n"
    "          world.places[pid] = { name: placeName, exits: ['street'], owner: id, dynamic: true };\n"
    "        }\n"
    "        actor.location = pid;\n"
    "        if (!actor.home || actor.home === 'street') actor.home = pid;\n"
    "        saveState(DATA_DIR, world);\n"
    "        console.log(`[Actor] ${actor.name} → ${placeName}`);\n"
    "        return sendJson(res, 200, { ok: true, place: placeName });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s and '/api/admin/actor/move' not in s:
    s = s.replace(anchor, inject, 1)
    print('added actor move endpoint')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
