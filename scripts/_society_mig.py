import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'ensureClans' not in s:
    s = s.replace("import { ensureFactions } from './factions.js';",
                  "import { ensureFactions } from './factions.js';\nimport { ensureClans } from './clans.js';\nimport { ensureFame } from './reputation.js';\nimport { ensureMarket } from './prices.js';")
    anchor = "  try { ensureFactions(world); } catch (e) { console.warn('[Faction] 势力初始化失败：', e.message); }"
    add = anchor + """
  try { ensureMarket(world); } catch { /* 忽略 */ }
  try { ensureFame(world); } catch { /* 忽略 */ }
  try { ensureClans(world); } catch { /* 忽略 */ }"""
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('迁移里建物价/名声/宗族')
