import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "  try {\n    const boss = world.actors?.waner ? 'waner'"
if old in s:
    s = s.replace(old, "  try {\n    if (false) { /* 暂时停用，定位回归失败 */ }\n    const boss = world.actors?.waner ? 'waner'", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('临时停用孤儿迁移')
