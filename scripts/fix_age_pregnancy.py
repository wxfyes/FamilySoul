import io

# ① 年龄映射：老鸨不该是 64 岁
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "      else if (/先生|老鸨|婆|老夫子/.test(role)) a.age = 55 + (id.length % 10);"
new = ("      else if (/老鸨|鸨母/.test(role)) a.age = 38 + (id.length % 8);\n"
       "      else if (/先生|老夫子|夫子/.test(role)) a.age = 58 + (id.length % 8);\n"
       "      else if (/婆/.test(role)) a.age = 48 + (id.length % 10);")
if old in s:
    s = s.replace(old, new, 1)
    print('① 老鸨年龄改为 38~45，先生/婆分开')

# ② 清理不合生理的怀孕
mig = """export function migrateOwnership(world) {
  // 清理不合生理的怀孕（年龄过大/过小，或身份明确不该有的）
  try {
    let cleared = 0;
    for (const a of Object.values(world.actors || {})) {
      if (!a || !a.pregnancy || a.pregnancy.born) continue;
      const age = Number(a.age) || 0;
      const role = String(a.role || '');
      const tooOld = age > 48;
      const tooYoung = age > 0 && age < 14;
      const sterile = /老鸨|鸨母|嬷嬷|婆婆|尼|道姑/.test(role);
      if (tooOld || tooYoung || sterile) {
        delete a.pregnancy;
        cleared += 1;
        console.log(`[Life] ${a.name}（${age}岁·${role}）的怀孕记录不合生理，已清除`);
      }
    }
    if (cleared) console.log(`[Life] 共清除 ${cleared} 条不合生理的怀孕`);
  } catch { /* 忽略 */ }"""
anchor = "export function migrateOwnership(world) {"
if anchor in s and '不合生理' not in s:
    s = s.replace(anchor, mig, 1)
    print('② 加入怀孕清理迁移')

io.open(p, 'w', encoding='utf-8').write(s)

# ③ 受孕判定：年龄上限收紧 + 身份排除
p2 = 'src/pet-service.js'
d = io.open(p2, encoding='utf-8-sig').read()
old2 = "              const fertile = who.gender !== 'male' && age >= 16 && age <= 42;"
new2 = ("              const sterileRole = /老鸨|鸨母|嬷嬷|婆婆|尼|道姑/.test(String(who.role || ''));\n"
        "              const fertile = who.gender !== 'male' && age >= 16 && age <= 45 && !sterileRole;")
if old2 in d:
    d = d.replace(old2, new2, 1)
    print('③ 受孕年龄上限 45，身份排除老鸨')
io.open(p2, 'w', encoding='utf-8').write(d)
print('done')
