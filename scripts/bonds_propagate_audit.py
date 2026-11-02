import io

# ① 关系变动传导：dispatch 里 relation 操作后调用 propagateMood
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

if "propagateMood" not in s:
    s = s.replace(
        "import { nextEvent, round2 } from './state.js';",
        "import { nextEvent, round2 } from './state.js';\nimport { propagateMood } from './bonds.js';",
    )
    print('imported propagateMood')

# 在 relation 应用处触发（找到 applied.push(`关系: 或 relation 分支结束）
old = "          applied.push(`关系:${who}.${key}${delta >= 0 ? '+' : ''}${delta}`);"
new = (
    "          applied.push(`关系:${who}.${key}${delta >= 0 ? '+' : ''}${delta}`);\n"
    "          try {\n"
    "            if (key === 'grievance') propagateMood(world, who, delta);\n"
    "          } catch { /* 忽略 */ }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: mood propagation on grievance')
else:
    print('WARN: relation apply line not found')

io.open(p, 'w', encoding='utf-8').write(s)

# ② audit：关系网指向的人必须存在
p2 = 'src/world/audit.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

if 'auditBonds' not in s2:
    s2 += (
        "\n/** 关系网自检：不许指向不存在的人 */\n"
        "export function auditBonds(world) {\n"
        "  const issues = [];\n"
        "  for (const [a, map] of Object.entries(world?.bonds || {})) {\n"
        "    if (!world.actors?.[a]) { issues.push(`关系网里有不存在的人：${a}`); continue; }\n"
        "    for (const b of Object.keys(map || {})) {\n"
        "      if (!world.actors?.[b]) issues.push(`${world.actors[a]?.name || a} 的关系指向不存在的人：${b}`);\n"
        "    }\n"
        "  }\n"
        "  return issues;\n"
        "}\n"
    )
    print('added auditBonds')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
