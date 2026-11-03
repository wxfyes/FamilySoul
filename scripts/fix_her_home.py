import io

# ① 去"X家" → 直接去那个人所在的地方
p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "  // 「去某城」：城里没有长街就先修一条（不能把人塞进府衙）"
add = (
    "  // 「去X家 / X的绣坊」：认到那个人真实所在，别另建一处\n"
    "  if (mentioned.length === 0 && /(去|往|到|上|回)/.test(say)) {\n"
    "    const homeHit = Object.values(world.actors || {}).find((a) => {\n"
    "      if (!a || !a.name || a.id === selfId || a.id === 'husband') return false;\n"
    "      return new RegExp(`${a.name}(家|的|处)`).test(say);\n"
    "    });\n"
    "    if (homeHit && world.places?.[homeHit.location]) {\n"
    "      if (me.location !== homeHit.location) {\n"
    "        me.location = homeHit.location;\n"
    "        saveState(dataDir, world);\n"
    "        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: world.places[homeHit.location].name };\n"
    "      }\n"
    "      return { moved: [], summoned: [], visited: null, wentTo: world.places[homeHit.location].name, alreadyThere: true };\n"
    "    }\n"
    "  }\n\n"
    "  // 「去某城」：城里没有长街就先修一条（不能把人塞进府衙）"
)
if anchor in s and 'homeHit' not in s:
    s = s.replace(anchor, add, 1)
    print('patched: 去X家 maps to X location')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 在场判定：地点 id 或地点名相同都算在场
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

old = (
    "          const knownActor = Object.values(wLoc.actors || {}).find((a) => a && a.name === who);\n"
    "          if (knownActor && knownActor.location !== locId2) {"
)
new = (
    "          const knownActor = Object.values(wLoc.actors || {}).find((a) => a && a.name === who);\n"
    "          const samePlaceName = knownActor && wLoc.places?.[knownActor.location]?.name\n"
    "            && wLoc.places?.[knownActor.location]?.name === wLoc.places?.[locId2]?.name;\n"
    "          if (knownActor && knownActor.location !== locId2 && !samePlaceName) {"
)
if old in s2:
    s2 = s2.replace(old, new, 1)
    print('patched: same place name counts as present')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
