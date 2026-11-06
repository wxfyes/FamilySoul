import io
# ① 取消家眷"按点回房"的限制：谁都不被作息牵着走，改由自己的目标带着走
p = 'src/world/room-life.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  // 主人家眷白天不锁死在屋里：只有夜里（21 时后）才回房，白天随她在府里走动"""
new = """  // 活人不按钟点搬：作息只作参考，去哪由她自己的打算决定
  if (actor.household) return null;

  // 主人家眷白天不锁死在屋里：只有夜里（21 时后）才回房，白天随她在府里走动"""
if old in s and '活人不按钟点搬' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 家眷不再按点搬')

# ② Tick 里推进目标
p2 = 'src/world/tick.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { ensureStalls } from './stalls.js';",
              "import { ensureStalls } from './stalls.js';\nimport { refreshGoals, pursueGoals } from './goals.js';", 1)
old2 = """  // ── ④ 身份标签随日子变 + 街头摊子按点来去 ──"""
new2 = """  // ── ③.6 每人自己的打算：一天一遍，逐时辰推进 ──
  try {
    const fresh = refreshGoals(world);
    const moved2 = pursueGoals(world);
    if (fresh || moved2) note += `${note ? '；' : ''}${fresh} 人有了打算，${moved2} 人动了身`;
  } catch { /* 忽略 */ }

  // ── ④ 身份标签随日子变 + 街头摊子按点来去 ──"""
if old2 in t and '每人自己的打算' not in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② tick 推进目标')
