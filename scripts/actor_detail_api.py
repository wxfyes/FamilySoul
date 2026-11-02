import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.26h 人物志 GET /api/admin/actor/detail?id=xxx\n"
    "    if (req.method === 'GET' && pathname === '/api/admin/actor/detail') {\n"
    "      try {\n"
    "        const id = String(url.searchParams.get('id') || '');\n"
    "        const world = peek(DATA_DIR);\n"
    "        const a = world.actors?.[id];\n"
    "        if (!a) return sendJson(res, 404, { ok: false, error: '没有这个人' });\n"
    "        const bonds = Object.entries(world.bonds?.[id] || {})\n"
    "          .map(([oid, b]) => ({ name: world.actors?.[oid]?.name || oid, type: b.type, score: b.score }))\n"
    "          .sort((x, y) => Math.abs(y.score) - Math.abs(x.score))\n"
    "          .slice(0, 8);\n"
    "        const arc = (world.npcArcs || {})[id] || (world.arcs || {})[id] || null;\n"
    "        const cases = (world.cases || []).filter((c) => c && (c.whoId === id || c.againstId === id)).slice(-5)\n"
    "          .map((c) => ({ claim: c.claim, status: c.status, verdict: c.verdict || '', reason: c.reason || '', day: c.day, role: c.whoId === id ? '原告' : '被告' }));\n"
    "        const props = (world.assets?.properties || []).filter((x) => x && (x.owner === id || x.keeper === id))\n"
    "          .map((x) => ({ name: x.name, income: x.incomePerDay, staff: x.staff || 0, role: x.owner === id ? '东家' : '掌柜' }));\n"
    "        const knows = (world.rumors || []).filter((r) => (r.heardBy || []).includes(id)).slice(-4).map((r) => r.text);\n"
    "        return sendJson(res, 200, {\n"
    "          ok: true,\n"
    "          actor: {\n"
    "            id: a.id, name: a.name, role: a.role, gender: a.gender, place: world.places?.[a.location]?.name || '',\n"
    "            origin: a.origin || 'preset', age: a.age || null, rank: a.rank || '', study: a.study || 0,\n"
    "            goals: a.goals || [], secret: a.secret || '',\n"
    "            rel: a.relations?.husband || null, activity: a.activity?.text || '',\n"
    "            jailed: a.jailed || null, dead: Boolean(a.dead),\n"
    "          },\n"
    "          bonds, arc, cases, props, knows,\n"
    "          money: id === 'husband' ? (Number(world.assets?.silver) || 0) : (Number(world.wallets?.[id]) || 0),\n"
    "        });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s and '/api/admin/actor/detail' not in s:
    s = s.replace(anchor, inject, 1)
    print('added actor detail endpoint')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
