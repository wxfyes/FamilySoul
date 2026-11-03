import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "export function migrateOwnership(world) {"
if 'try { seedMenses(world); }' not in s:
    s = s.replace(anchor, anchor + "\n  try { seedMenses(world); } catch { /* 忽略 */ }", 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已在迁移里调用 seedMenses')
else:
    print('已存在')
