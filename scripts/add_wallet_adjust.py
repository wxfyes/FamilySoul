import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.26c 手动调账 POST /api/admin/wallet {actor, delta, reason}\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/wallet') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const world = peek(DATA_DIR);\n"
    "        const actor = String(body.actor || 'husband');\n"
    "        const delta = Number(body.delta) || 0;\n"
    "        if (!delta) return sendJson(res, 400, { ok: false, error: 'delta 不能为 0' });\n"
    "        world.wallets = world.wallets || {};\n"
    "        if (actor === 'husband') {\n"
    "          world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + delta) * 100) / 100;\n"
    "        } else {\n"
    "          const cur = Number(world.wallets[actor]) || 0;\n"
    "          world.wallets[actor] = Math.max(0, Math.round((cur + delta) * 100) / 100);\n"
    "        }\n"
    "        saveState(DATA_DIR, world);\n"
    "        console.log(`[Wallet] ${actor} ${delta > 0 ? '+' : ''}${delta} 两（${String(body.reason || '').slice(0, 20)}）`);\n"
    "        return sendJson(res, 200, {\n"
    "          ok: true,\n"
    "          actor,\n"
    "          silver: actor === 'husband' ? world.assets.silver : world.wallets[actor],\n"
    "          husbandSilver: world.assets.silver,\n"
    "        });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s and '/api/admin/wallet' not in s:
    s = s.replace(anchor, inject, 1)
    print('added wallet adjust endpoint')
else:
    print('WARN: anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
