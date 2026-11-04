import io
# 迁移里按 id 刷一遍派生名字（把"名字当主键"的历史残留对齐）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "export function migrateOwnership(world) {"
add = """export function migrateOwnership(world) {
  // 名字只是标签：按 id 把派生字段里的名字对齐（改过名也不会乱）
  try { syncNames(world); } catch { /* 忽略 */ }"""
if anchor in s and 'syncNames(world)' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('迁移里对齐派生名字')

if 'identity.js' not in s:
    s = s.replace("import { moveActor } from './world/position.js';",
                  "import { moveActor } from './world/position.js';\nimport { syncNames } from './identity.js';", 1) if "from './world/position.js'" in s else s
    if "from './identity.js'" not in s:
        idx = s.find('\n', s.find('import '))
        s = s[:idx+1] + "import { syncNames } from './identity.js';\n" + s[idx+1:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('state 引入 syncNames')
