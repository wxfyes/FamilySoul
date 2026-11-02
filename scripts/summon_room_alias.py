import io

p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "  if (mentioned.length === 0 && /(去|往|上|到|回|逛)/.test(say)) {\n    const placeHit = findPlace(world, say);"
new = (
    "  if (mentioned.length === 0 && /(去|往|上|到|回|逛)/.test(say)) {\n"
    "    // \"回我房间/去正房\"这类说法：先按别名认\n"
    "    const roomAlias = { 我房间: 'husband_room', 我的房间: 'husband_room', 我房里: 'husband_room', 正房: 'husband_room', 上房: 'husband_room', 卧房: 'husband_room', 寝室: 'husband_room' };\n"
    "    const aliasKey = Object.keys(roomAlias).find((k) => String(say).includes(k));\n"
    "    if (aliasKey && world.places?.[roomAlias[aliasKey]]) {\n"
    "      const pid = roomAlias[aliasKey];\n"
    "      const p = world.places[pid];\n"
    "      if (me.location !== pid) {\n"
    "        me.location = pid;\n"
    "        saveState(dataDir, world);\n"
    "        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: p.name };\n"
    "      }\n"
    "      return { moved: [], summoned: [], visited: null, wentTo: p.name, alreadyThere: true };\n"
    "    }\n"
    "    const placeHit = findPlace(world, say);"
)
if old in s and 'roomAlias' not in s:
    s = s.replace(old, new, 1)
    print('patched: room alias in summon')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
