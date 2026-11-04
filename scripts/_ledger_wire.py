import io
# ① 服务端：pay 走 ledger；payload 带流水
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'ledger.js' not in s:
    s = s.replace("import { buildTimeline, eventText } from './world/events-view.js';",
                  "import { buildTimeline, eventText } from './world/events-view.js';\nimport { spendSilver, recentLedger } from './world/ledger.js';", 1)
    print('引入 ledger')

# 手动付账
s = s.replace("""          world.assets.silver = Math.round((silver0 - amount) * 100) / 100;""",
"""          const spent0 = spendSilver(world, amount, title, me?.id || 'husband');
          if (!spent0.ok) return sendJson(res, 200, { ok: false, error: spent0.error });""", 1)

# 天道报价付款
s = s.replace("""        if (actorId === 'husband') world.assets.silver = Math.round((silver - price) * 100) / 100;
        else world.wallets = { ...(world.wallets || {}), [actorId]: Math.round((silver - price) * 100) / 100 };""",
"""        if (actorId === 'husband') {
          const spent1 = spendSilver(world, price, `${pend.title || '花销'}·${opt?.label || ''}`, 'husband');
          if (!spent1.ok) return sendJson(res, 200, { ok: false, error: spent1.error });
        } else {
          world.wallets = { ...(world.wallets || {}), [actorId]: Math.round((silver - price) * 100) / 100 };
        }""", 1)

# payload 带最近流水
s = s.replace("          timeline: buildTimeline(world, readRecentEvents(DATA_DIR, 40), 14),",
              "          timeline: buildTimeline(world, readRecentEvents(DATA_DIR, 40), 14),\n          ledger: recentLedger(world, 8),", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('server 接 ledger')
