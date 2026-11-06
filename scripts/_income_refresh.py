import io
# 导出"重算产业日入"，开业后立刻见效
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function refreshPropertyIncomes' not in s:
    s += '''

/** 重算所有产业的当日进项（开业、换日、验收时用） */
export function refreshPropertyIncomes(world) {
  for (const p of (world?.assets?.properties || [])) {
    try { dailyIncomeOf(world, p); } catch { /* 忽略 */ }
  }
  return (world?.assets?.properties || []).length;
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('导出重算')

p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { buildMemberCard } from './world/member-card.js';",
              "import { buildMemberCard } from './world/member-card.js';\nimport { refreshPropertyIncomes } from './world/clock.js';", 1)
old = """          for (const p of closed) { p.status = '已开张'; p.openedDay = wO.clock?.day || 1; }
          saveState(this.dataDir, wO);"""
new = """          for (const p of closed) { p.status = '已开张'; p.openedDay = wO.clock?.day || 1; }
          try { refreshPropertyIncomes(wO); } catch { /* 忽略 */ }
          saveState(this.dataDir, wO);"""
if old in t and 'refreshPropertyIncomes(wO)' not in t:
    t = t.replace(old, new, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('开业即重算')
