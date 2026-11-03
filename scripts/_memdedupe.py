import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "export function migrateOwnership(world) {"
add = (
    "export function migrateOwnership(world) {\n"
    "  // 旧事去重：同一句记两遍只留一遍\n"
    "  try {\n"
    "    const seen = new Set();\n"
    "    world.memories = (world.memories || []).filter((m) => {\n"
    "      const t = String(m?.text || '').trim();\n"
    "      if (!t) return false;\n"
    "      if (seen.has(t)) return false;\n"
    "      seen.add(t);\n"
    "      return true;\n"
    "    });\n"
    "  } catch { /* 忽略 */ }"
)
if anchor in s and '旧事去重' not in s:
    s = s.replace(anchor, add, 1)
    print('added memory dedupe')
io.open(p, 'w', encoding='utf-8').write(s)
