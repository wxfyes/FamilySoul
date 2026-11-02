import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

# 1) 建朝官时就放到他该在的城
old = "        home: world.places?.['yamen'] ? 'yamen' : 'street',\n        location: 'yamen',"
new = "        home: ensureGovPlace(world, city),\n        location: ensureGovPlace(world, city),"
if old in s:
    s = s.replace(old, new)
    print('patched: central officials start in their own city')
else:
    print('WARN: seed location lines not found')

# 2) 老存档迁移：朝官也别留在临江县衙
anchor = "  // 老存档迁移：已经存在的各府官员，别都挤在临江县衙"
add = (
    "  // 老存档迁移：朝官（天子/宰相/尚书/巡抚/知府）回到各自的城\n"
    "  const seedCity = {\n"
    "    emperor: '京城', chancellor: '京城', revenue: '京城', war: '京城',\n"
    "    governor: '苏州府', prefect: '临江府',\n"
    "  };\n"
    "  for (const [id, cityName] of Object.entries(seedCity)) {\n"
    "    const actor = world.actors?.[id];\n"
    "    if (!actor) continue;\n"
    "    if (actor.location && actor.location !== 'yamen') continue;\n"
    "    const govPlace = ensureGovPlace(world, cityName);\n"
    "    actor.location = govPlace;\n"
    "    actor.home = govPlace;\n"
    "  }\n\n"
    "  // 老存档迁移：已经存在的各府官员，别都挤在临江县衙"
)
if anchor in s and '朝官（天子/宰相/尚书/巡抚/知府）回到各自的城' not in s:
    s = s.replace(anchor, add, 1)
    print('added migration for central officials')
else:
    print('WARN: migration anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
