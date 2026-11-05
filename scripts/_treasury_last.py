import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      if (cur < 100000) {
        tr.silver = 1200000;
        tr.grain = Math.max(Number(tr.grain) || 0, 800);"""
new = """      if (cur < 100000) {
        tr.silver = 1200000;
        tr.grain = Math.max(Number(tr.grain) || 0, 800);
        // 昨天的收/支是民间尺度算的，一并换成国库尺度
        if (Number(tr.lastIncome) < 10000) tr.lastIncome = Math.round((Number(tr.lastIncome) || 0) * 100 * 100) / 100;
        if (Number(tr.lastExpense) < 10000) tr.lastExpense = Math.round((Number(tr.lastExpense) || 0) * 100 * 100) / 100;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('昨日收支一并换算')
