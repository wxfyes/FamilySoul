import io

# ① 同步场景时：模糊地名不新建，归到真地方
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "      let placeName = placeNameRaw.join('·');"
new = (
    "      let placeName = placeNameRaw.join('·');\n"
    "      // 「院中/屋里/房中」这类不是地名，归到真实所在，别另建一处\n"
    "      const VAGUE = /^(院中|院子里|庭院|院里|院|屋里|屋中|房中|屋内|屋里头|厅上|堂中|门口|门外)$/;\n"
    "      if (VAGUE.test(placeName)) {\n"
    "        const meV = world.actors?.[selfId] || world.actors?.husband;\n"
    "        const homePlace = meV?.home && world.places?.[meV.home] ? meV.home : null;\n"
    "        const back = world.places?.backyard ? 'backyard' : null;\n"
    "        const target = homePlace || back || meV?.location;\n"
    "        if (target && world.places?.[target]) {\n"
    "          console.log(`[Scene] 「${placeName}」不是地名，按${world.places[target].name}算`);\n"
    "          return { place: world.places[target].name, moved: [] };\n"
    "        }\n"
    "      }"
)
if old in s and '不是地名，按' not in s:
    s = s.replace(old, new, 1)
    print('patched: vague place names mapped')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 迁移：把已建出来的垃圾地名并回后院暖阁
p2 = 'src/world/state.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

anchor = "export function migrateOwnership(world) {"
add = (
    "export function migrateOwnership(world) {\n"
    "  // 清掉误建的模糊地名（院中/屋里/房中…），人挪回后院暖阁\n"
    "  try {\n"
    "    const junk = /^(院中|院子里|庭院|院里|院|屋里|屋中|房中|屋内|屋里头|厅上|堂中|门口|门外)$/;\n"
    "    for (const [pid, pl] of Object.entries(world.places || {})) {\n"
    "      if (!pl || !junk.test(String(pl.name || ''))) continue;\n"
    "      const back = world.places?.backyard ? 'backyard' : (world.places?.tea_house ? 'tea_house' : null);\n"
    "      if (!back) continue;\n"
    "      delete world.places[pid];\n"
    "      for (const a of Object.values(world.actors || {})) {\n"
    "        if (a && a.location === pid) a.location = back;\n"
    "        if (a && a.home === pid) a.home = back;\n"
    "      }\n"
    "      console.log(`[State] 垃圾地名「${pl.name}」已并回${world.places[back].name}`);\n"
    "    }\n"
    "  } catch { /* 忽略 */ }"
)
if anchor in s2 and '垃圾地名「' not in s2:
    s2 = s2.replace(anchor, add, 1)
    print('added junk place migration')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
