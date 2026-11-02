import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.25 世界步进 POST /api/admin/world/step {days}"
inject = (
    "    // 9.24 世界回滚 POST /api/admin/world/rewind {day, hour, trim}\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/world/rewind') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const w = peek(DATA_DIR);\n"
    "        const day = Math.max(1, Number(body.day) || 1);\n"
    "        const hour = Math.max(0, Math.min(23, Number(body.hour) || 0));\n"
    "        const trim = body.trim !== false;\n"
    "        w.clock.day = day;\n"
    "        w.clock.hour = hour;\n"
    "        w.lastRealAt = Date.now();\n"
    "        let trimmed = 0;\n"
    "        if (trim) {\n"
    "          const before = (w.cases || []).length + (w.rumors || []).length + (w.memorials || []).length;\n"
    "          w.cases = (w.cases || []).filter((c) => Number(c.day) <= day);\n"
    "          w.rumors = (w.rumors || []).filter((r) => Number(r.day) <= day);\n"
    "          w.memorials = (w.memorials || []).filter((m) => Number(m.day) <= day);\n"
    "          if (w.court) {\n"
    "            w.court.decisions = (w.court.decisions || []).filter((d) => Number(d.day) <= day);\n"
    "            w.court.lastDecreeDay = Math.min(Number(w.court.lastDecreeDay) || 0, day);\n"
    "          }\n"
    "          const after = w.cases.length + w.rumors.length + w.memorials.length;\n"
    "          trimmed = before - after;\n"
    "          w.flags = w.flags || {};\n"
    "          w.flags.pendingCase = null;\n"
    "          w.flags.crimeCheckedDay = day;\n"
    "          w.history = (w.history || []).filter((h) => Number(h.day) <= day);\n"
    "        }\n"
    "        // 主线退回关口之前\n"
    "        for (const arc of Object.values(w.arcs || {})) {\n"
    "          if (!arc) continue;\n"
    "          if (Number(arc.stage) > 3) arc.stage = 3;\n"
    "          arc.atEdge = false;\n"
    "        }\n"
    "        saveState(DATA_DIR, w);\n"
    "        console.log(`[World] 回滚到第${day}日${hour}时（清掉 ${trimmed} 条后续记录）`);\n"
    "        return sendJson(res, 200, { ok: true, clock: w.clock, trimmed });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.25 世界步进 POST /api/admin/world/step {days}"
)
if anchor in s and '/api/admin/world/rewind' not in s:
    s = s.replace(anchor, inject, 1)
    print('added rewind endpoint')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
