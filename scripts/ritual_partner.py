import io

p = 'src/world/ritual.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "export function resolveRitualActor(world, roleName) {\n"
    "  if (roleName === '傲娇助手') return 'waner';\n"
    "  for (const [id, a] of Object.entries(world.actors || {})) {\n"
    "    if (a?.role === roleName) return id;\n"
    "  }\n"
    "  return null;\n"
    "}"
)
new = (
    "export function resolveRitualActor(world, roleName, memberKey = 'husband') {\n"
    "  // ① 你正在跟谁说话，就解禁谁（对话对象优先）\n"
    "  const partner = (world.chatPartners || {})[memberKey];\n"
    "  if (partner && world.actors?.[partner] && partner !== 'husband') return partner;\n"
    "  // ② 屋里只有一位主子，那就是她\n"
    "  const place = world.actors?.[memberKey]?.location || world.actors?.husband?.location;\n"
    "  const here = Object.entries(world.actors || {}).filter(\n"
    "    ([id, a]) => a && !a.dead && a.location === place && id !== 'husband' && id !== memberKey && !a.servant,\n"
    "  );\n"
    "  if (here.length === 1) return here[0][0];\n"
    "  // ③ 退回角色名\n"
    "  if (roleName === '傲娇助手') return 'waner';\n"
    "  for (const [id, a] of Object.entries(world.actors || {})) {\n"
    "    if (a?.role === roleName) return id;\n"
    "  }\n"
    "  return null;\n"
    "}"
)
if old in s:
    s = s.replace(old, new)
    print('patched: ritual targets current partner')

old2 = "  const actorId = resolveRitualActor(world, roleName);"
new2 = "  const actorId = resolveRitualActor(world, roleName, memberKey);"
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: pass memberKey')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
