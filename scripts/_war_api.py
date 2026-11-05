import io

# ============ ① server：势力与兵权接口 ============
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'warfare.js' not in s:
    s = s.replace("import { buildOpeningFacts, buildOpeningPrompt } from './world/opening.js';",
                  "import { buildOpeningFacts, buildOpeningPrompt } from './world/opening.js';\n"
                  "import { ensureFactions, factionOf, factionSilver, factionStrength } from './world/factions.js';\n"
                  "import { recruit, buyGrain, besiege, bribeCity, fortify } from './world/warfare.js';\n"
                  "import { buildStrategyPrompt, applyStrategyDecisions } from './world/strategy.js';", 1)
    print('① server 引入兵权模块')

anchor = "    // 0.05 落地第一幕：新人进世界，天道主动开口（只生成一次）"
block = '''    // 0.04 兵权：募兵 / 买粮 / 围城 / 招降 / 修城（玩家侧）
    if (req.method === 'POST' && pathname.startsWith('/api/world/military')) {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 64 * 1024);
        const world = loadState(DATA_DIR);
        ensureFactions(world);
        const fid = 'wangjia';
        const f = factionOf(world, fid);
        if (!f) return sendJson(res, 404, { ok: false, error: '没有这个势力' });

        const act = String(body.action || '');
        let result = { ok: false, error: '未知动作' };
        if (act === 'recruit') result = recruit(world, fid, Number(body.count) || 0);
        else if (act === 'grain') result = buyGrain(world, fid, Number(body.shi) || 0);
        else if (act === 'siege') result = besiege(world, { attacker: fid, cityName: String(body.city || ''), troops: Number(body.troops) || 0 });
        else if (act === 'bribe') result = bribeCity(world, fid, String(body.city || ''), Number(body.amount) || 0);
        else if (act === 'fortify') result = fortify(world, fid, String(body.city || ''), Number(body.amount) || 200);

        if (result.ok) saveState(DATA_DIR, world);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

''' + anchor
if '/api/world/military' not in s:
    s = s.replace(anchor, block, 1)
    print('② 加兵权接口')

# 势力写进世界负载（给 App / 看板用）
if 'factions: Object.values(world.factions' not in s:
    s = s.replace("        clues: (world.clues || []).slice(-12),",
                  "        clues: (world.clues || []).slice(-12),\n"
                  "        factions: Object.values(world.factions || {}).map((f) => ({\n"
                  "          id: f.id, name: f.name, kind: f.kind, leader: f.leader,\n"
                  "          troops: Number(f.troops) || 0, grain: Math.round((Number(f.grain) || 0) * 10) / 10,\n"
                  "          silver: Math.round(factionSilver(world, f) * 100) / 100,\n"
                  "          morale: Number(f.morale) || 0, ambition: Number(f.ambition) || 0,\n"
                  "          strength: factionStrength(world, f), cities: (f.cities || []).slice(0, 12),\n"
                  "        })),", 1)
    print('③ 负载带势力')

# ============ ② 天道推演：每 7 日一次（LLM），失败回落规则推演 ============
old_tick = """      onAfterTick: async () => {
        await dailyAuditWorld();"""
new_tick = """      onAfterTick: async () => {
        // 天下推演：每 7 个世界日一次，有天道就让它定夺，没有就交给规则
        try {
          const w0 = peek(DATA_DIR);
          const day0 = Number(w0.clock?.day) || 1;
          const lastRun = Number(w0.flags?.lastStrategyDay) || 0;
          if (day0 !== lastRun && day0 % 7 === 0) {
            ensureFactions(w0);
            let applied = [];
            if (petService.llmClient?.isReady?.()) {
              const { system, user } = buildStrategyPrompt(w0);
              const out = await petService.llmClient.complete({
                system, messages: [{ role: 'user', content: user }], temperature: 0.7, maxTokens: 700,
              });
              const text = typeof out === 'string' ? out : (out?.text || out?.content || '');
              const m = text.match(/\\[[\\s\\S]*\\]/);
              if (m) {
                try {
                  const decisions = JSON.parse(m[0]);
                  applied = applyStrategyDecisions(w0, decisions, (w, ev) => {
                    try { w.events = Array.isArray(w.events) ? w.events : []; } catch { /* 忽略 */ }
                  });
                } catch (e) { console.warn('[Strategy] 决策解析失败:', e.message); }
              }
            }
            w0.flags = w0.flags || {};
            w0.flags.lastStrategyDay = day0;
            saveState(DATA_DIR, w0);
            if (applied.length) console.log('[Strategy] 天下推演：' + applied.join('；'));
          }
        } catch (err) {
          console.warn('[Strategy] 推演失败：', err.message);
        }
        await dailyAuditWorld();"""
if old_tick in s and 'lastStrategyDay' not in s:
    s = s.replace(old_tick, new_tick, 1)
    print('④ 每7日天道推演')

io.open(p, 'w', encoding='utf-8-sig').write(s)
