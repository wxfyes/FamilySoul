import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("export function ensureResidence(world, rootId, { scale = 0 } = {}) {",
              "export function ensureResidence(world, rootId, { scale = 0, ownerId = null } = {}) {")
s = s.replace("""  root.rooms = root.rooms || {};
  root.grade = grade;
  root.residence = true;""",
"""  root.rooms = root.rooms || {};
  root.grade = grade;
  root.residence = true;
  if (ownerId && !root.owner) root.owner = ownerId;""")
s = s.replace("      owner: root.owner || null,", "      owner: root.owner || ownerId || null,")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('residence 接收 ownerId')

p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("const r = ensureResidence(world, pid, { scale });", "const r = ensureResidence(world, pid, { scale, ownerId: prop?.owner || null });")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('迁移传入 owner')
