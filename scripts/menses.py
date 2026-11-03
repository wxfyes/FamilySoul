import io

# ============ ① state.js：给女性播种月事周期 ============
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

helper = """
/** 给女性播种月事周期（28 天一轮，行经 4~6 天）*/
export function seedMenses(world) {
  const day = Number(world.clock?.day) || 1;
  let seeded = 0;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.gender !== 'female') continue;
    if (a.menses && typeof a.menses.cycleDay === 'number') continue;
    const age = Number(a.age) || 24;
    if (age < 13 || age > 52) continue;
    const h = String(a.id || a.name || '').split('').reduce((x, c) => (x * 131 + c.charCodeAt(0)) >>> 0, 11);
    a.menses = {
      cycle: 28,
      periodLen: 4 + (h % 3),           // 4~6 天
      cycleDay: h % 28,                  // 起始点错开
      sinceDay: day,
    };
    seeded += 1;
  }
  if (seeded) console.log(`[Menses] 给 ${seeded} 位女性播种月事周期`);
  return seeded;
}
"""
if 'seedMenses' not in s:
    anchor = "export function ensureCourt(world) {"
    s = s.replace(anchor, helper + "\n" + anchor, 1)
    print('① 加入 seedMenses')

if 'seedMenses(world)' not in s:
    anchor2 = "export function migrateOwnership(world) {"
    s = s.replace(anchor2, anchor2 + "\n  try { seedMenses(world); } catch { /* 忽略 */ }", 1)
    print('② 迁移时自动播种')

io.open(p, 'w', encoding='utf-8').write(s)

# ============ ② clock.js：每日推进 + 例假状态 ============
p2 = 'src/world/clock.js'
c = io.open(p2, encoding='utf-8-sig').read()

fn = """
/**
 * 月事：28 天一轮，行经 4~6 天。
 * 这几天她身子不爽、不愿同房，也怀不上——这不是惩罚，是常识。
 */
function runMenses(world) {
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.gender !== 'female' || !a.menses) continue;
    const m = a.menses;
    m.cycleDay = ((Number(m.cycleDay) || 0) + 1) % (Number(m.cycle) || 28);
    const on = m.cycleDay < (Number(m.periodLen) || 5);
    if (on !== Boolean(m.on)) {
      m.on = on;
      const rel = a.relations?.husband;
      if (rel) {
        if (on) rel.grievance = Math.min(100, Math.round((Number(rel.grievance) || 0) + 1));
      }
      console.log(`[Menses] ${a.name}${on ? '来了月事' : '月事已净'}`);
    }
  }
}
"""
if 'function runMenses' not in c:
    anchor = "function runPersonalEconomy(world, events) {"
    c = c.replace(anchor, fn + "\n" + anchor, 1)
    print('③ 加入 runMenses')

if 'runMenses(world);' not in c:
    c = c.replace("  runPersonalEconomy(world, events);", "  runMenses(world);\n  runPersonalEconomy(world, events);", 1)
    print('④ 接入每日推进')

io.open(p2, 'w', encoding='utf-8').write(c)

# ============ ③ 受孕：来月事就怀不上 ============
p3 = 'src/pet-service.js'
d = io.open(p3, encoding='utf-8-sig').read()
old = "              if (fertile && !already) {"
new = "              const onPeriod = Boolean(who.menses?.on);\n              if (fertile && !already && !onPeriod) {"
if old in d and 'onPeriod' not in d:
    d = d.replace(old, new, 1)
    print('⑤ 来月事不受孕')
elif 'onPeriod' in d:
    print('⑤ 已有月经避孕判断')

# ============ ④ 接口下发 ============
old2 = "            money: typeof a.money === 'number' ? a.money : null,"
new2 = "            money: typeof a.money === 'number' ? a.money : null,\n            onPeriod: Boolean(a.menses?.on),"
if old2 in d:
    pass
io.open(p3, 'w', encoding='utf-8').write(d)

p4 = 'src/server.js'
e = io.open(p4, encoding='utf-8-sig').read()
if "onPeriod: Boolean(a.menses?.on)," not in e:
    e = e.replace("            money: typeof a.money === 'number' ? a.money : null,",
                  "            money: typeof a.money === 'number' ? a.money : null,\n            onPeriod: Boolean(a.menses?.on),", 1)
    print('⑥ 接口下发 onPeriod')
io.open(p4, 'w', encoding='utf-8').write(e)

print('done')
