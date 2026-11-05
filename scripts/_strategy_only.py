import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find('        // 天下推演：每 7 个世界日一次，有天道就让它定夺，没有就交给规则')
end = s.find('        await dailyAuditWorld();', start)
if start < 0 or end < 0:
    raise SystemExit('strategy block not found')

new_block = '''        // 天下推演：每 7 个世界日一次，有天道就让它定夺，没有就交给规则
        // 两段式：await LLM 期间不留可写世界；回来重新读盘再合并
        try {
          const snap = peek(DATA_DIR);
          const day0 = Number(snap.clock?.day) || 1;
          const lastRun = Number(snap.flags?.lastStrategyDay) || 0;
          if (day0 !== lastRun && day0 % 7 === 0) {
            let decisions = null;
            if (petService.llmClient?.isReady?.()) {
              const promptWorld = peek(DATA_DIR);
              ensureFactions(promptWorld);
              const { system, user } = buildStrategyPrompt(promptWorld);
              try {
                const out = await petService.llmClient.complete({
                  system, messages: [{ role: 'user', content: user }], temperature: 0.7, maxTokens: 700,
                });
                const text = typeof out === 'string' ? out : (out?.text || out?.content || '');
                const m = text.match(/\\[[\\s\\S]*\\]/);
                if (m) decisions = JSON.parse(m[0]);
              } catch (e) { console.warn('[Strategy] 决策获取失败:', e.message); }
            }
            const world = loadState(DATA_DIR);
            const dayNow = Number(world.clock?.day) || 1;
            if (dayNow === day0 && Number(world.flags?.lastStrategyDay) !== day0) {
              ensureFactions(world);
              let applied = [];
              if (Array.isArray(decisions) && decisions.length) {
                world.flags = world.flags || {};
                world.flags.strategyByLLM = true;
                applied = applyStrategyDecisions(world, decisions, (w, ev) => {
                  try { w.events = Array.isArray(w.events) ? w.events : []; } catch { /* 忽略 */ }
                });
              }
              world.flags = world.flags || {};
              world.flags.lastStrategyDay = day0;
              saveState(DATA_DIR, world);
              if (applied.length) console.log('[Strategy] 天下推演：' + applied.join('；'));
            }
          }
        } catch (err) {
          console.warn('[Strategy] 推演失败：', err.message);
        }

'''

s = s[:start] + new_block + s[end:]
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('strategy two-phase applied')
