import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'demography.js' not in s:
    s = s.replace("import { runAging } from './aging.js';",
                  "import { runAging } from './aging.js';\nimport { runDemography } from './demography.js';", 1)
    print('① 引入人口补充')
anchor = """  // 每月：士林清议、宗族走动（都只说事实，不写台词）"""
block = """  // 每月：人口补充（年轻未婚的人太少，市井自然补进几个）
  try {
    runDemography(world, nextEvent, events);
  } catch (err) {
    console.warn('[Demo] 人口补充失败：', err.message);
  }

""" + anchor
if 'runDemography(world, nextEvent, events)' not in s:
    s = s.replace(anchor, block, 1)
    print('② 时钟接人口补充')
io.open(p, 'w', encoding='utf-8-sig').write(s)
