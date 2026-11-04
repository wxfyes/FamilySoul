import io

# ============ ① 撤掉我那个"按身份钉位置"的补丁 ============
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find('// 按身份把人钉在该在的地方')
end = s.find('function runSchedules(world) {', start)
if start >= 0 and end > start:
    s = s[:start] + s[end:]
    # 去掉 tick 里的调用
    s = s.replace("  runSchedules(world);\n  try { runRoutines(world); } catch { /* 忽略 */ }",
                  "  runSchedules(world);")
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 已撤掉按身份写死的作息补丁')

# ============ ② 接入 society 自愈 ============
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()

# 引入
old_imp = "import { startWorldClock, peek, buildMorningReport } from './world/clock.js';"
new_imp = old_imp + "\nimport { detectDrift, buildDriftPrompt, applyPlacements, shouldHeal } from './world/society.js';"
if old_imp in t and 'society.js' not in t:
    t = t.replace(old_imp, new_imp, 1)
    print('② 引入 society')

# 自愈函数（放在 startWorldClock 之前）
anchor = "  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）"
fn = """  // 人间自愈：人挤在一处、铺子空着时，请天道重新安顿一次（它决定，引擎只落账）
  const selfHealWorld = async () => {
    try {
      const world = loadState(DATA_DIR);
      const drift = detectDrift(world);
      if (!drift) return;
      if (!shouldHeal(world, false)) return;
      if (!llmClient.isReady()) return;
      const { system, user } = buildDriftPrompt(world, drift);
      const text = await llmClient.complete({
        system,
        messages: [{ role: 'user', content: user }],
        temperature: 0.4,
        maxTokens: 1500,
      });
      const r = applyPlacements(world, text);
      world.flags = world.flags || {};
      world.flags.lastSelfHealDayHour = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
      saveState(DATA_DIR, world);
      console.log(`[Society] 天道安顿人间：动 ${r.changed} 人 ${r.error ? '（' + r.error + '）' : ''}`);
    } catch (err) {
      console.warn('[Society] 自愈失败：', err.message);
    }
  };
  globalThis.__selfHealWorld = selfHealWorld;

"""
if anchor in t and 'selfHealWorld' not in t:
    t = t.replace(anchor, fn + anchor, 1)
    print('③ 加自愈函数')

# tick 里调用
old_tick = """      onAfterTick: async () => {
        await fillProactiveTexts();"""
new_tick = """      onAfterTick: async () => {
        await selfHealWorld();
        await fillProactiveTexts();"""
if old_tick in t:
    t = t.replace(old_tick, new_tick, 1)
    print('④ 挂到心跳上')

io.open(p2, 'w', encoding='utf-8').write(t)
print('done')
