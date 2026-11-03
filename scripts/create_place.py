import io

p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "  // 「去X家 / X的绣坊」：认到那个人真实所在，别另建一处"
add = (
    "  // 提到一个世上没有的地方：天道现造一处（医馆、茶楼、银楼、镖局…）\n"
    "  if (mentioned.length === 0) {\n"
    "    const mPlace = say.match(/(?:去|往|到|上|回|进)([一-龥]{2,6}?(?:馆|铺|楼|坊|堂|店|院|阁|斋|局|行|庄|园|寺|庵|祠|码头|渡口|桥|街|巷|市|集|仓|监|牢|营|寨))/);\n"
    "    if (mPlace) {\n"
    "      const wantName = mPlace[1];\n"
    "      const exists = Object.entries(world.places || {}).find(([, pl]) => String(pl?.name || '').replace(/·.*$/, '').includes(wantName));\n"
    "      if (exists) {\n"
    "        const [pid, pl] = exists;\n"
    "        if (me.location !== pid) {\n"
    "          me.location = pid;\n"
    "          saveState(dataDir, world);\n"
    "        }\n"
    "        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: pl.name };\n"
    "      }\n"
    "      // 没造过 → 造一处，落在长街上，能进能出\n"
    "      world.flags = world.flags || {};\n"
    "      world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;\n"
    "      const pid = `place_${world.flags.placeSeq}`;\n"
    "      world.places[pid] = {\n"
    "        name: wantName, exits: ['street'], dynamic: true, createdDay: world.clock?.day || 1,\n"
    "      };\n"
    "      me.location = pid;\n"
    "      saveState(dataDir, world);\n"
    "      console.log(`[World] 天道造了一处「${wantName}」`);\n"
    "      return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: wantName, created: wantName };\n"
    "    }\n"
    "  }\n\n"
    "  // 「去X家 / X的绣坊」：认到那个人真实所在，别另建一处"
)
if anchor in s and '天道造了一处' not in s:
    s = s.replace(anchor, add, 1)
    print('patched: summon creates missing place')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
