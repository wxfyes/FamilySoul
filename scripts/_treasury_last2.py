import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "  // 税率落成数据：没写过的补 10%"
add = """  // 国库昨日收支：上一次只换了存量，昨天那两个数还是民间尺度，这里补换一次
  try {
    world.flags = world.flags || {};
    if (!world.flags.treasuryLastScaled) {
      const tr = world.court?.treasury;
      if (tr) {
        if (Number(tr.lastIncome) > 0 && Number(tr.lastIncome) < 10000) tr.lastIncome = Math.round(Number(tr.lastIncome) * 100 * 100) / 100;
        if (Number(tr.lastExpense) > 0 && Number(tr.lastExpense) < 10000) tr.lastExpense = Math.round(Number(tr.lastExpense) * 100 * 100) / 100;
      }
      world.flags.treasuryLastScaled = { day: world.clock?.day || 1 };
    }
  } catch { /* 忽略 */ }

""" + anchor
if anchor in s and 'treasuryLastScaled' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('补换昨日收支')
