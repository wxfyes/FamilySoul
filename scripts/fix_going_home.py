import io

p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  if (leaving) {\n"
    "    // 相公说\"走了\" = 离开这里上街；她自己说\"回家\" = 回自己家\n"
    "    const isHusband = !selfId || selfId === 'husband';\n"
    "    const exits = world.places?.[me.location]?.exits || [];\n"
    "    const home = isHusband\n"
    "      ? (exits.includes('street') ? 'street' : exits[0] || 'street')\n"
    "      : ((me.home && world.places?.[me.home] ? me.home : null) || (world.places?.tea_house ? 'tea_house' : 'street'));"
)
new = (
    "  if (leaving) {\n"
    "    const isHusband = !selfId || selfId === 'husband';\n"
    "    const exits = world.places?.[me.location]?.exits || [];\n"
    "    const goingHome = /(回家|回去|回房|回屋|回后院)/.test(say);\n"
    "    // 相公\"回家\" = 回正房；\"走了/出门\" = 上街\n"
    "    const home = isHusband\n"
    "      ? (goingHome\n"
    "        ? (world.places?.husband_room ? 'husband_room' : (world.places?.backyard ? 'backyard' : (world.places?.tea_house ? 'tea_house' : 'street')))\n"
    "        : (exits.includes('street') ? 'street' : exits[0] || 'street'))\n"
    "      : ((me.home && world.places?.[me.home] ? me.home : null) || (world.places?.tea_house ? 'tea_house' : 'street'));"
)
if old in s:
    s = s.replace(old, new)
    print('patched: husband 回家 -> 正房')
else:
    print('WARN: leaving block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
