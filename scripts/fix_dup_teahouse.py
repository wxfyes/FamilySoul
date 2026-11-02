import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 删掉重复的种子
old = "    teahouse_shop: { name: '临江茶坊', exits: ['street', 'backyard', 'husband_room'], owner: 'husband' },\n"
if old in s:
    s = s.replace(old, '', 1)
    print('removed duplicate teahouse_shop seed')

# ② 迁移：把人搬回 tea_house，删掉假地点
anchor = "export function migrateOwnership(world) {"
add = (
    "export function migrateOwnership(world) {\n"
    "  // 清掉误建的重复茶坊（teahouse_shop），把人挪回 tea_house\n"
    "  try {\n"
    "    if (world.places?.teahouse_shop) {\n"
    "      delete world.places.teahouse_shop;\n"
    "      for (const a of Object.values(world.actors || {})) {\n"
    "        if (a && a.location === 'teahouse_shop') a.location = 'tea_house';\n"
    "        if (a && a.home === 'teahouse_shop') a.home = 'tea_house';\n"
    "      }\n"
    "    }\n"
    "  } catch { /* 忽略 */ }"
)
if anchor in s and '清掉误建的重复茶坊' not in s:
    s = s.replace(anchor, add, 1)
    print('added teahouse_shop migration')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
