import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）"
inject = (
    "  // 手动步进：推进 N 个世界日，并把依赖天道的那几套（案子/判决/折子/朝议/补街）跑一遍\n"
    "  async function stepWorld(days = 1) {\n"
    "    const { tick } = await import('./world/clock.js');\n"
    "    const msPerHour = Number(config.world?.msPerWorldHour) || 60 * 60 * 1000;\n"
    "    const base = Date.now();\n"
    "    const done = [];\n"
    "    for (let i = 0; i < Math.max(1, Math.min(30, days)); i += 1) {\n"
    "      const before = peek(DATA_DIR).clock?.day || 1;\n"
    "      tick(DATA_DIR, { now: base + (i + 1) * 24 * msPerHour, msPerWorldHour: msPerHour });\n"
    "      try { await generateCase(); } catch (e) { /* 忽略 */ }\n"
    "      try { await judgeCases(); } catch (e) { /* 忽略 */ }\n"
    "      try { await resolveMemorials(); } catch (e) { /* 忽略 */ }\n"
    "      try { await generateDecree(); } catch (e) { /* 忽略 */ }\n"
    "      try { await generateCityShops(); } catch (e) { /* 忽略 */ }\n"
    "      try { await generateNpcArcs(); } catch (e) { /* 忽略 */ }\n"
    "      const after = peek(DATA_DIR).clock?.day || 1;\n"
    "      done.push(`${before}→${after}`);\n"
    "    }\n"
    "    return done;\n"
    "  }\n\n"
    "  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）"
)
if anchor in s and 'stepWorld' not in s:
    s = s.replace(anchor, inject, 1)
    print('added stepWorld')

# 路由
anchor2 = "    // 9.26h 人物志 GET /api/admin/actor/detail?id=xxx"
inject2 = (
    "    // 9.25 世界步进 POST /api/admin/world/step {days}\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/world/step') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const days = Number(body.days) || 1;\n"
    "        const log = await stepWorld(days);\n"
    "        const world = peek(DATA_DIR);\n"
    "        return sendJson(res, 200, { ok: true, steps: log, clock: world.clock });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.26h 人物志 GET /api/admin/actor/detail?id=xxx"
)
if anchor2 in s and '/api/admin/world/step' not in s:
    s = s.replace(anchor2, inject2, 1)
    print('added step route')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
