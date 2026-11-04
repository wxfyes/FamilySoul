import io
# ① applyRepairs：地点按名字或 id 都能认，孤儿地点挂回长街
p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (f?.kind === 'place' && world.places?.[who]) {
      const ex = Object.keys(world.places).find((k) => k !== who);
      if (ex) { world.places[who].exits = [ex]; fixed += 1; }
    }"""
new = """    if (f?.kind === 'place') {
      const pid = world.places?.[who] ? who : nameToPlace.get(who);
      if (pid && world.places[pid]) {
        const pl = world.places[pid];
        const ex = Array.isArray(pl.exits) ? pl.exits.filter((x) => world.places?.[x]) : [];
        if (!ex.length) {
          const back = world.places.street ? 'street'
            : Object.keys(world.places).find((k) => k !== pid) || null;
          if (back) { pl.exits = [back]; fixed += 1; }
        }
      }
    }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 孤儿地点挂回长街')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 加手动修账接口
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "    // 删掉误立的地方，把人送回一处（管理用）"
block = """    // 立刻跑一次结构自检并修账（诊断/验收）
    if (req.method === 'POST' && pathname === '/api/admin/audit/repair') {
      try {
        const world = loadState(DATA_DIR);
        ensureRealms(world);
        const issues = inspectStructure(world);
        let fixed = 0;
        if (llmClient.isReady() && issues.length) {
          const { system, user } = buildRepairPrompt(world, issues);
          const out = await llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.3, maxTokens: 1200 });
          const text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '');
          fixed = applyRepairs(world, text).fixed;
        } else {
          fixed = applyRepairs(world, '').fixed;
        }
        world.flags = world.flags || {};
        world.flags.lastAuditDay = Number(world.clock?.day) || 1;
        saveState(DATA_DIR, world);
        const left = inspectStructure(world);
        return sendJson(res, 200, { ok: true, found: issues.length, fixed, left: left.length, remaining: left.slice(0, 10) });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

"""
if '/api/admin/audit/repair' not in t:
    t = t.replace(anchor, block + anchor, 1)
    print('② 加手动修账接口')
io.open(p2, 'w', encoding='utf-8').write(t)
