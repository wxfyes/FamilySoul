import io

# ① 去某城：落在"该城的长街"，没有就建一条
p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "  // 「去某地」：话里带了账本里已有的地名（全名或尾两字），就把相公挪过去"
add = (
    "  // 「去某城」：城里没有长街就先修一条（不能把人塞进府衙）\n"
    "  if (mentioned.length === 0 && /(去|往|到|上|回)/.test(say)) {\n"
    "    const cityHit = Object.keys(world.cities || {}).find((c) => String(say).includes(c));\n"
    "    if (cityHit) {\n"
    "      const streetName = `${cityHit}·长街`;\n"
    "      let pid = Object.keys(world.places || {}).find((k) => world.places[k]?.name === streetName);\n"
    "      if (!pid) {\n"
    "        world.flags = world.flags || {};\n"
    "        world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;\n"
    "        pid = `place_${world.flags.placeSeq}`;\n"
    "        const gov = Object.keys(world.places || {}).find((k) => String(k).startsWith('gov_') && String(world.places[k]?.name || '').includes(cityHit));\n"
    "        world.places[pid] = { name: streetName, exits: ['street', ...(gov ? [gov] : [])], dynamic: true, city: cityHit };\n"
    "      }\n"
    "      if (me.location !== pid) {\n"
    "        me.location = pid;\n"
    "        saveState(dataDir, world);\n"
    "        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: streetName, city: cityHit };\n"
    "      }\n"
    "      return { moved: [], summoned: [], visited: null, wentTo: streetName, alreadyThere: true, city: cityHit };\n"
    "    }\n"
    "  }\n\n"
    "  // 「去某地」：话里带了账本里已有的地名（全名或尾两字），就把相公挪过去"
)
if anchor in s and 'cityHit' not in s:
    s = s.replace(anchor, add, 1)
    print('patched: travel to city street')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
