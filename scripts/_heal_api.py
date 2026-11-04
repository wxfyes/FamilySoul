import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 9.31b 改世界人物属性"
block = """    // 人间自愈：手动让天道安顿一次（诊断/验收用）
    if (req.method === 'POST' && pathname === '/api/admin/world/heal') {
      try {
        const world = loadState(DATA_DIR);
        const drift = detectDrift(world);
        if (!drift) return sendJson(res, 200, { ok: true, healed: false, reason: '人没挤在一起，不用治' });
        if (!llmClient.isReady()) return sendJson(res, 200, { ok: false, reason: 'LLM 未就绪' });
        const { system, user } = buildDriftPrompt(world, drift);
        const text = await llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.4, maxTokens: 1500 });
        const r = applyPlacements(world, text);
        world.flags = world.flags || {};
        world.flags.lastSelfHealDayHour = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, healed: true, changed: r.changed, notes: (r.notes || []).slice(0, 20), error: r.error || null });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

"""
if '/api/admin/world/heal' not in s:
    s = s.replace(anchor, block + anchor, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已加自愈诊断接口')
