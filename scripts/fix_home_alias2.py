import io

# ① 别名补 "回房/回屋"
p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace(
    "const roomAlias = { 我房间: 'husband_room', 我的房间: 'husband_room', 我房里: 'husband_room', 正房: 'husband_room', 上房: 'husband_room', 卧房: 'husband_room', 寝室: 'husband_room' };",
    "const roomAlias = { 我房间: 'husband_room', 我的房间: 'husband_room', 我房里: 'husband_room', 回房: 'husband_room', 回屋: 'husband_room', 正房: 'husband_room', 上房: 'husband_room', 卧房: 'husband_room', 寝室: 'husband_room' };",
)

# ② "我走了"在街上时 → 回正房，而不是又绕进茶坊
s = s.replace(
    "        : (exits.includes('street') ? 'street' : exits[0] || 'street'))",
    "        : (exits.includes('street') ? 'street' : (world.places?.husband_room ? 'husband_room' : exits[0] || 'street')))",
)
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
