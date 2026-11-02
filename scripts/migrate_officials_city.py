import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "  return world.court;\n}"
inject = (
    "  // 老存档迁移：已经存在的各府官员，别都挤在临江县衙\n"
    "  for (const [post, off] of Object.entries(world.court.offices || {})) {\n"
    "    if (!post.startsWith('city:') || !off?.holder) continue;\n"
    "    const cityName = post.slice(5);\n"
    "    const govPlace = ensureGovPlace(world, cityName);\n"
    "    const actor = world.actors?.[off.holder];\n"
    "    if (actor && actor.location === 'yamen') {\n"
    "      actor.location = govPlace;\n"
    "      actor.home = govPlace;\n"
    "    }\n"
    "  }\n\n"
    "  return world.court;\n}"
)
if anchor in s and '老存档迁移：已经存在的各府官员' not in s:
    s = s.replace(anchor, inject, 1)
    print('added migration for existing officials')
else:
    print('WARN: anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
