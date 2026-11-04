import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 引入
old_imp = "import { auditWorld } from './world/audit.js';"
new_imp = "import { auditWorld, inspectStructure, buildRepairPrompt, applyRepairs } from './world/audit.js';\nimport { ensureRealms } from './world/realm.js';"
if old_imp in s and 'inspectStructure' not in s:
    s = s.replace(old_imp, new_imp, 1)
    print('① 引入自检模块')

# ② 每日自检函数 + 心跳调用
anchor = "  // 人间自愈：人挤在一处、铺子空着时，请天道重新安顿一次（它决定，引擎只落账）"
fn = """  // 每日自检：查"不成立"的事实，请天道修；它没修的按最保守办法兜底
  const dailyAuditWorld = async () => {
    try {
      const world = loadState(DATA_DIR);
      ensureRealms(world);
      const issues = inspectStructure(world);
      if (!issues.length) return;
      const today = Number(world.clock?.day) || 1;
      if (Number(world.flags?.lastAuditDay || 0) === today) return;   // 一天只查一次
      let fixed = 0;
      if (llmClient.isReady()) {
        const { system, user } = buildRepairPrompt(world, issues);
        const out = await llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.3, maxTokens: 1200 });
        const text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '');
        const r = applyRepairs(world, text);
        fixed = r.fixed;
      } else {
        const r = applyRepairs(world, '');
        fixed = r.fixed;
      }
      world.flags = world.flags || {};
      world.flags.lastAuditDay = today;
      saveState(DATA_DIR, world);
      console.log(`[Audit] 自检 ${issues.length} 处不成立，修 ${fixed} 处`);
    } catch (err) {
      console.warn('[Audit] 自检失败：', err.message);
    }
  };
  globalThis.__dailyAuditWorld = dailyAuditWorld;

"""
if anchor in s and 'dailyAuditWorld' not in s:
    s = s.replace(anchor, fn + anchor, 1)
    print('② 加每日自检函数')

old_tick = """      onAfterTick: async () => {
        await selfHealWorld();"""
new_tick = """      onAfterTick: async () => {
        await dailyAuditWorld();
        await selfHealWorld();"""
if old_tick in s and 'dailyAuditWorld();' not in s:
    s = s.replace(old_tick, new_tick, 1)
    print('③ 挂到心跳')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
