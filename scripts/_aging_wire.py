import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'aging.js' not in s:
    s = s.replace("import { propertySeasonFactor, maybeOutbreak, canalFrozen } from './season.js';",
                  "import { propertySeasonFactor, maybeOutbreak, canalFrozen } from './season.js';\nimport { runAging } from './aging.js';", 1)
    print('① 引入 aging')
anchor = """  // 物价：指数每日回归，再被灾荒、战事、丰收冲击"""
block = """  // 岁时：长岁、及冠、衰朽（每 30 日一次）
  try {
    runAging(world, events, nextEvent);
  } catch (err) {
    console.warn('[Aging] 岁月结算失败：', err.message);
  }

""" + anchor
if 'runAging(world, events, nextEvent)' not in s:
    s = s.replace(anchor, block, 1)
    print('② 时钟接岁月')
io.open(p, 'w', encoding='utf-8-sig').write(s)
