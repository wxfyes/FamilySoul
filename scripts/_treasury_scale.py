import io
# 国库初值与阈值一起换成国家尺度；老存档（几千两）一次性抬到百万级
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("const tr = world.court.treasury = world.court.treasury || { silver: 1200, grain: 800, lastIncome: 0, lastExpense: 0 };",
              "const tr = world.court.treasury = world.court.treasury || { silver: 1200000, grain: 800, lastIncome: 0, lastExpense: 0 };")
s = s.replace("  if (tr.silver < 300) {", "  if (tr.silver < 300000) {")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('① 初值/阈值国家化')

p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "  // 税率落成数据：没写过的补 10%"
add = """  // 国库尺度：历史上的"几百两"是民间尺度误用，一次性抬到国家尺度（百万级）
  try {
    world.flags = world.flags || {};
    if (!world.flags.treasuryScaleDone) {
      world.court = world.court || {};
      const tr = world.court.treasury = world.court.treasury || {};
      const cur = Number(tr.silver) || 0;
      if (cur < 100000) {
        tr.silver = 1200000;
        tr.grain = Math.max(Number(tr.grain) || 0, 800);
        console.log('[Treasury] 国库改按国家尺度记账：1200000 两（原 %s 两）', cur);
      }
      world.flags.treasuryScaleDone = { day: world.clock?.day || 1 };
    }
  } catch { /* 忽略 */ }

""" + anchor
if anchor in t and '国库尺度' not in t:
    t = t.replace(anchor, add, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 迁移抬国库到百万级')
