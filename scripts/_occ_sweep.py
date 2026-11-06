import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { evictOutsiders } from './privacy.js';",
              "import { evictOutsiders } from './privacy.js';\nimport { refreshTitles } from './occupation.js';\nimport { ensureStalls } from './stalls.js';", 1)
old = """      const evicted = evictOutsiders(world);          // 混进后宅的外人，请出去"""
new = """      const evicted = evictOutsiders(world);          // 混进后宅的外人，请出去
      try { refreshTitles(world); } catch { /* 忽略 */ }   // 身份跟着营生变
      try { ensureStalls(world, 'street'); } catch { /* 忽略 */ }  // 街上的摊子按点来去"""
if old in s and 'refreshTitles(world)' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 巡检里也刷新身份/摊子')
