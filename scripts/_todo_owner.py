import io

# ============ ① 承诺/约定：写入"归谁"（owner） ============
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
# 三处创建点：统一带上 owner（调用方是谁就归谁；默认相公）
s = s.replace("""          world.promises.push({
            text: String(args.text || '').slice(0, 80),
            due: due,""",
"""          world.promises.push({
            owner: String((opts && opts.selfId) || 'husband'),
            text: String(args.text || '').slice(0, 80),
            due: due,""", 1)
s = s.replace("""          world.appointments.push({
            actorId: id || null,""",
"""          world.appointments.push({
            owner: String((opts && opts.selfId) || 'husband'),
            actorId: id || null,""", 1)
s = s.replace("""          world.promises.push({
            text: `${world.actors[fromId]?.name || '相公'}借给""",
"""          world.promises.push({
            owner: String(fromId || 'husband'),
            text: `${world.actors[fromId]?.name || '相公'}借给""", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('① dispatch 三处写入 owner')

# ② server 借款补记
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("""          world.promises.push({
            text: `${fromName}借给${toName}""",
"""          world.promises.push({
            owner: String(from || 'husband'),
            text: `${fromName}借给${toName}""", 1)
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('② 借款承诺带 owner')

# ③ 迁移：老数据补齐 owner
p3 = 'src/world/state.js'
u = io.open(p3, encoding='utf-8-sig').read()
anchor = "export function migrateOwnership(world) {"
add = """export function migrateOwnership(world) {
  // 待办归属：老数据没写 owner 的，一律算相公的（那是当时唯一的主角）
  try {
    for (const pr of world.promises || []) {
      if (pr && !pr.owner) pr.owner = 'husband';
    }
    for (const ap of world.appointments || []) {
      if (ap && !ap.owner) ap.owner = ap.actorId === 'husband' ? 'husband' : 'husband';
    }
  } catch { /* 忽略 */ }"""
if anchor in u and '待办归属' not in u:
    u = u.replace(anchor, add, 1)
    io.open(p3, 'w', encoding='utf-8-sig').write(u)
    print('③ 迁移补齐 owner')
