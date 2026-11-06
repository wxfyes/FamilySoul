import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    try { dailyIncomeOf(world, p); } catch { /* 忽略 */ }"""
new = """    try {
      const before = p.incomePerDay;
      const g = dailyIncomeOf(world, p);
      if (/花|铺/.test(String(p.name || ''))) console.log(`[ShopDbg] ${p.name} status=${p.status} gain=${g} before=${before} after=${p.incomePerDay}`);
    } catch (e) { console.log('[ShopDbg]', p.name, e.message); }"""
if old in s and 'ShopDbg' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加调试日志')
