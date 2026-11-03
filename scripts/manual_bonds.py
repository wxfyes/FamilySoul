import io

p = 'src/world/bonds.js'
s = io.open(p, encoding='utf-8-sig').read()

# 派生关系不许覆盖"人为/事件改过"的关系
old = "  const cur = world.bonds[a][b];\n  if (cur && Math.abs(cur.score) >= Math.abs(score)) return;"
new = "  const cur = world.bonds[a][b];\n  if (cur && (cur.manual || Math.abs(cur.score) >= Math.abs(score))) return;"
if old in s:
    s = s.replace(old, new, 1)
    print('patched: derived bonds skip manual ones')

# shiftBond 打上 manual 标记
old2 = "  world.bonds[aId][bId] = { type, score: next };\n  world.bonds[bId][aId] = { type, score: next };"
new2 = "  world.bonds[aId][bId] = { type, score: next, manual: true };\n  world.bonds[bId][aId] = { type, score: next, manual: true };"
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: mark adjusted bonds manual')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
