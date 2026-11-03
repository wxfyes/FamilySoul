import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "export function migrateOwnership(world) {"
add = (
    "export function migrateOwnership(world) {\n"
    "  // 没写年龄的人给个合理岁数（不然生老病死跑不起来）\n"
    "  try {\n"
    "    const FIXED = { waner: 24, yunnia: 21, xiaocui: 17, aji: 19, husband: 26 };\n"
    "    for (const [id, a] of Object.entries(world.actors || {})) {\n"
    "      if (!a || a.dead || a.age) continue;\n"
    "      if (FIXED[id]) { a.age = FIXED[id]; continue; }\n"
    "      const role = String(a.role || '');\n"
    "      if (/天子/.test(role)) a.age = 42;\n"
    "      else if (/宰相|尚书|巡抚/.test(role)) a.age = 52 + (id.length % 6);\n"
    "      else if (/知府|知县/.test(role)) a.age = 44 + (id.length % 8);\n"
    "      else if (/先生|老鸨|婆|老夫子/.test(role)) a.age = 55 + (id.length % 10);\n"
    "      else if (/寡妇|妇人/.test(role)) a.age = 28 + (id.length % 8);\n"
    "      else if (/丫鬟|小厮|伙计/.test(role)) a.age = 16 + (id.length % 6);\n"
    "      else a.age = 20 + (id.length % 25);\n"
    "    }\n"
    "  } catch { /* 忽略 */ }"
)
if anchor in s and 'FIXED = { waner' not in s:
    s = s.replace(anchor, add, 1)
    print('added default ages')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
