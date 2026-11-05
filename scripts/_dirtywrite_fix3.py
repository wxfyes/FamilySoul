import io, re

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ============ ① 天下推演：两段式（await 前只读，await 后重新读盘合并） ============
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
print('strategy two-phase ok')

# ============ ② saveDelta 合并写盘 helper ============
anchor = '  async function processMigrants() {'
helper = '''  /**
   * 只把"这次真正改过的字段"写回最新世界。
   * 用于"读盘 → await 大模型 → 存盘"的路径：等 LLM 的几秒里玩家可能改了别的东西，
   * 整份 saveState 会把那些操作回滚；按字段合并只覆盖本流程动过的部分。
   */
  function saveDelta(before, after) {
    if (!before) { saveState(DATA_DIR, after); return; }
    try {
      const fresh = loadState(DATA_DIR);
      for (const key of Object.keys(after || {})) {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) fresh[key] = after[key];
      }
      saveState(DATA_DIR, fresh);
    } catch (e) {
      console.warn('[Save] 合并写盘失败，回退整份保存：', e.message);
      saveState(DATA_DIR, after);
    }
  }

''' + anchor
if 'function saveDelta' not in s:
    s = s.replace(anchor, helper, 1)
    print('saveDelta added')

# ============ ③ 七个生成器：记录快照 + 合并写盘 ============
names = ['fillProactiveTexts', 'resolveMemorials', 'generateCase', 'judgeCases',
         'generateCityShops', 'generateDecree', 'generateNpcArcs']
for name in names:
    i = s.find(f'async function {name}')
    if i < 0:
        print('missing', name); continue
    j = s.find('\n  async function ', i + 10)
    if j < 0:
        j = len(s)
    body = s[i:j]
    # 1) 找 peek 行，插入快照
    m = re.search(r'(\n(\s*)const world = peek\(DATA_DIR\);)', body)
    if m and '__before' not in body:
        indent = m.group(2)
        body = body.replace(m.group(1), m.group(1) + f'\n{indent}const __before = JSON.parse(JSON.stringify(world));', 1)
    # 2) 本函数内的 saveState(DATA_DIR, world) 全部换成 saveDelta
    body = body.replace('saveState(DATA_DIR, world);', 'saveDelta(__before, world);')
    s = s[:i] + body + s[j:]
    print('patched', name, '| snapshot:', '__before' in body)

io.open(p, 'w', encoding='utf-8-sig').write(s)
