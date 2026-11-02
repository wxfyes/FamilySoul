import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

# 1) 建一个"某府府衙"的地点
helper = (
    "/** 给某座城建一个府衙地点，返回 placeId */\n"
    "function ensureGovPlace(world, cityName) {\n"
    "  world.places = world.places || {};\n"
    "  const pid = `gov_${cityName}`;\n"
    "  if (!world.places[pid]) {\n"
    "    world.places[pid] = { name: `${cityName}府衙`, exits: ['street'], owner: 'court', dynamic: false };\n"
    "  }\n"
    "  return pid;\n"
    "}\n\n"
)
if 'ensureGovPlace' not in s:
    s = s.replace("export function ensureCourt(world) {", helper + "export function ensureCourt(world) {", 1)
    print('added ensureGovPlace')

# 2) 每城建官时，把人放到自己城的府衙
old = (
    "    world.court.offices[post] = { title: `${cityName}知府`, holder: id, vacant: false, city: cityName };"
)
new = (
    "    const govPlace = ensureGovPlace(world, cityName);\n"
    "    const offActor = world.actors[id];\n"
    "    if (offActor && (!offActor.location || offActor.location === 'yamen')) {\n"
    "      offActor.location = govPlace;\n"
    "      offActor.home = govPlace;\n"
    "    }\n"
    "    world.court.offices[post] = { title: `${cityName}知府`, holder: id, vacant: false, city: cityName };"
)
if old in s:
    s = s.replace(old, new)
    print('patched: officials live in their own city')
else:
    print('WARN: office assignment line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
