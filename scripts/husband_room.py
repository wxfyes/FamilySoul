import io

# ① 种子：相公的正房
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    tea_house: { name: '临江茶坊', exits: ['street', 'backyard'], owner: 'husband' },"
new = (
    "    husband_room: { name: '正房', exits: ['tea_house', 'backyard'], owner: 'husband' },\n"
    "    tea_house: { name: '临江茶坊', exits: ['street', 'backyard', 'husband_room'], owner: 'husband' },"
)
if old in s and 'husband_room:' not in s:
    s = s.replace(old, new, 1)
    print('seeded husband_room')

# ② 迁移：老存档里可能有个叫 "husband_room" / "我房间" 的怪地名
anchor = "export function migrateOwnership(world) {"
if anchor in s and 'husband_room 归一' not in s:
    add = (
        "export function migrateOwnership(world) {\n"
        "  // 相公的房间归一：别让账本里出现 \"husband_room\" 这种地名\n"
        "  world.places = world.places || {};\n"
        "  if (!world.places.husband_room) {\n"
        "    world.places.husband_room = { name: '正房', exits: ['tea_house', 'backyard'], owner: 'husband' };\n"
        "  } else {\n"
        "    const hr = world.places.husband_room;\n"
        "    if (!hr.name || /husband_room|我房间|我的房间/.test(String(hr.name))) hr.name = '正房';\n"
        "    hr.owner = hr.owner || 'husband';\n"
        "    hr.exits = Array.isArray(hr.exits) && hr.exits.length ? hr.exits : ['tea_house', 'backyard'];\n"
        "  }\n"
        "  for (const [pid, pl] of Object.entries(world.places)) {\n"
        "    if (pid !== 'husband_room' && pl && /^(我房间|我的房间)$/.test(String(pl.name || ''))) {\n"
        "      delete world.places[pid];\n"
        "      for (const a of Object.values(world.actors || {})) {\n"
        "        if (a && a.location === pid) a.location = 'husband_room';\n"
        "      }\n"
        "    }\n"
        "  }\n"
    )
    s = s.replace(anchor, add, 1)
    print('added husband_room migration')

io.open(p, 'w', encoding='utf-8').write(s)

# ③ 别名：去我房间 / 回房 → 正房
p2 = 'src/world/dispatch.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old2 = "  const key = String(to).trim();\n  if (world.places?.[key]) return key;"
new2 = (
    "  const raw = String(to).trim();\n"
    "  const alias = { 我房间: 'husband_room', 我的房间: 'husband_room', 正房: 'husband_room', 上房: 'husband_room', 卧房: 'husband_room', 寝室: 'husband_room', 房里: 'husband_room', 我房里: 'husband_room' };\n"
    "  const key = alias[raw] && world.places?.[alias[raw]] ? alias[raw] : raw;\n"
    "  if (world.places?.[key]) return key;"
)
if old2 in s2:
    s2 = s2.replace(old2, new2)
    print('added room aliases')

# ④ 自动建的地方：带上出口，别成孤岛
old3 = "          world.places[place] = { name: String(args.to).slice(0, 20), exits: [], dynamic: true };"
new3 = (
    "          const fromPlace = world.actors[id]?.location;\n"
    "          world.places[place] = {\n"
    "            name: String(args.to).slice(0, 20),\n"
    "            exits: fromPlace ? [fromPlace] : [],\n"
    "            owner: id === 'husband' ? 'husband' : 'public',\n"
    "            dynamic: true,\n"
    "          };"
)
if old3 in s2:
    s2 = s2.replace(old3, new3)
    print('patched: auto place has exits/owner')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
