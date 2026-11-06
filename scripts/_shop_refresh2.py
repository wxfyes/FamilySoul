import io
# ① 去掉调试日志
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("      const before = p.incomePerDay;\n      const g = __dailyIncomeFn ? __dailyIncomeFn(world, p) : 0;\n      if (/花|铺/.test(String(p.name || ''))) console.log(`[ShopDbg] ${p.name} status=${p.status} gain=${g} before=${before} after=${p.incomePerDay}`);\n",
"      if (__dailyIncomeFn) __dailyIncomeFn(world, p);\n", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('① 清理调试')

# ② 验收接口直接按下限重算（日结时同一套规则也会生效）
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
old = """      const world = loadState(DATA_DIR);
      const n = refreshPropertyIncomes(world);
      saveState(DATA_DIR, world);"""
new = """      const world = loadState(DATA_DIR);
      try { refreshPropertyIncomes(world); } catch { /* 忽略 */ }
      // 开着的铺子按"一年挣出十倍租钱"的下限兜底（与日结同一规则）
      for (const p of (world.assets?.properties || [])) {
        const open = ['已开张', '正常营业'].includes(String(p.status || ''));
        if (!open) { p.incomePerDay = 0; continue; }
        const isShop = /铺|店|号|栈|坊/.test(String(p.name || '')) && !/酒楼|茶坊|茶栈|货栈/.test(String(p.name || ''));
        const rentYearly = Number(p.rentYearly || p.rentAnnual || 0);
        const floor = isShop ? (rentYearly > 0 ? rentYearly / 365 * 10 : 1.5) : 0.15;
        if ((Number(p.incomePerDay) || 0) < floor) p.incomePerDay = Math.round(floor * 100) / 100;
      }
      const n = (world.assets?.properties || []).length;
      saveState(DATA_DIR, world);"""
if old in t:
    t = t.replace(old, new, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 验收接口兜底')
