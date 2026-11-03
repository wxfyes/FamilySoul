import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "export function migrateOwnership(world) {"
add = (
    "export function migrateOwnership(world) {\n"
    "  // 位置必须是真的地方：指到不存在的 id（clinic 这种）就挪回住处或街上\n"
    "  try {\n"
    "    const fallback = world.places?.street ? 'street' : (world.places?.backyard ? 'backyard' : Object.keys(world.places || {})[0]);\n"
    "    for (const a of Object.values(world.actors || {})) {\n"
    "      if (!a) continue;\n"
    "      if (a.location && !world.places?.[a.location]) {\n"
    "        const back = world.places?.[a.home] ? a.home : fallback;\n"
    "        if (back) {\n"
    "          console.log(`[State] ${a.name} 位置失效(${a.location}) → ${world.places[back]?.name || back}`);\n"
    "          a.location = back;\n"
    "        }\n"
    "      }\n"
    "      if (a.home && !world.places?.[a.home]) a.home = fallback;\n"
    "    }\n"
    "  } catch { /* 忽略 */ }"
)
if anchor in s and '位置失效(' not in s:
    s = s.replace(anchor, add, 1)
    print('added location sanity migration')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
