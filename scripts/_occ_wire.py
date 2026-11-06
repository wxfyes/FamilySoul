import io
# ① Tick 里刷新标签 + 补摊子
p = 'src/world/tick.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("const num = (v) => {", "import { refreshTitles } from './occupation.js';\nimport { ensureStalls } from './stalls.js';\n\nconst num = (v) => {", 1)
old = """  return { grain: grainMoved, cities: citiesMoved, note: note || '无事' };"""
new = """  // ── ④ 身份标签随日子变 + 街头摊子按点来去 ──
  try {
    const t = refreshTitles(world);
    if (t) note += `${note ? '；' : ''}${t} 人换了身份`;
  } catch { /* 忽略 */ }
  try {
    const st = ensureStalls(world, 'street');
    if (st > 0) note += `${note ? '；' : ''}街上多了 ${st} 个摊`;
    else if (st < 0) note += `${note ? '；' : ''}${-st} 个摊收了`;
  } catch { /* 忽略 */ }

  return { grain: grainMoved, cities: citiesMoved, note: note || '无事' };"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① tick 刷新身份与摊子')
