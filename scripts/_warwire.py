import io
# 时钟：每日军需 + 每 7 日天下推演（无 LLM 时用规则推演）
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

# 引入
if 'warfare.js' not in s:
    first = s.find('\n', s.find('import '))
    s = s[:first+1] + "import { runMilitaryDay, setWarEventSink } from './warfare.js';\nimport { npcStrategyTurn } from './strategy.js';\n" + s[first+1:]
    print('① 引入 warfare/strategy')

# 把战术事件塞进世界事件流（在 runMilitaryDay 前后用 sink）
anchor = """  try {
    runTreasury(world, events);
  } catch (err) {
    console.warn('[Treasury] 国库结算失败：', err.message);
  }"""
add = """  try {
    runTreasury(world, events);
  } catch (err) {
    console.warn('[Treasury] 国库结算失败：', err.message);
  }

  // 军需：发饷、吃粮、欠饷逃兵（势力表里的兵）
  try {
    setWarEventSink((w, ev) => {
      try { events.push(nextEvent(w, ev)); } catch { /* 忽略 */ }
    });
    runMilitaryDay(world, events);
  } catch (err) {
    console.warn('[Army] 军需结算失败：', err.message);
  }

  // 每 7 日：无人指挥的势力自己动（有 LLM 时由 server 侧接管，这里兜底）
  try {
    const day = Number(world.clock?.day) || 1;
    if (day % 7 === 0) {
      npcStrategyTurn(world, events, (w, ev) => {
        try { events.push(nextEvent(w, ev)); } catch { /* 忽略 */ }
      });
    }
  } catch (err) {
    console.warn('[Strategy] 天下推演失败：', err.message);
  }"""
if anchor in s and 'runMilitaryDay(world, events)' not in s:
    s = s.replace(anchor, add, 1)
    print('② 每日军需 + 每7日推演')
io.open(p, 'w', encoding='utf-8-sig').write(s)
