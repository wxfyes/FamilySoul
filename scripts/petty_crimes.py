import io

# ① 牢房（男女分监）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    husband_room: { name: '正房', exits: ['tea_house', 'backyard'], owner: 'husband' },"
new = (
    "    husband_room: { name: '正房', exits: ['tea_house', 'backyard'], owner: 'husband' },\n"
    "    jail_male: { name: '县衙男牢', exits: ['yamen'], owner: 'court' },\n"
    "    jail_female: { name: '县衙女牢', exits: ['yamen'], owner: 'court' },"
)
if old in s and 'jail_male' not in s:
    s = s.replace(old, new, 1)
    print('seeded jails')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 每天：民间案子（偷鸡摸狗/斗殴/纵火/命案）+ 刑满释放
p2 = 'src/world/clock.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

anchor = "function markCourtDecree(world) {"
fn = (
    "/** 民间案子：民心越乱，案子越多。只记事实，不写过程。 */\n"
    "function runPettyCrimes(world, events) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  const hour = Number(world.clock?.hour) || 0;\n"
    "  // 刑满释放\n"
    "  for (const a of Object.values(world.actors || {})) {\n"
    "    if (!a || !a.jailed) continue;\n"
    "    if (day >= Number(a.jailed.untilDay || 0)) {\n"
    "      a.location = a.home || 'street';\n"
    "      delete a.jailed;\n"
    "      events.push(nextEvent(world, { action: 'released', actor: a.id, place: a.location, payload: { text: `${a.name}刑满出狱` }, isPublic: true }));\n"
    "    }\n"
    "  }\n"
    "  if (hour !== 6) return; // 每天卯时\n"
    "  const cities = Object.values(world.cities || {}).filter(Boolean);\n"
    "  const avgUnrest = cities.length ? cities.reduce((s, c) => s + (Number(c.unrest) || 0), 0) / cities.length : 0;\n"
    "  const p = 0.25 + Math.min(0.4, avgUnrest / 200);\n"
    "  if (Math.random() > p) return;\n"
    "  const pool = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== 'husband' && !a.jailed && !a.playerControlled);\n"
    "  if (pool.length < 2) return;\n"
    "  const culprit = pool[Math.floor(Math.random() * pool.length)];\n"
    "  const victim = pool[Math.floor(Math.random() * pool.length)];\n"
    "  if (culprit === victim) return;\n"
    "  const crimes = ['偷了邻居的鸡', '当街斗殴', '赌输了钱动手抢', '酒后砸了铺子', '私贩盐铁', '失火烧了半间屋'];\n"
    "  const crime = crimes[Math.floor(Math.random() * crimes.length)];\n"
    "  world.cases = Array.isArray(world.cases) ? world.cases : [];\n"
    "  world.flags = world.flags || {};\n"
    "  world.flags.caseSeq = (Number(world.flags.caseSeq) || 0) + 1;\n"
    "  world.cases.push({\n"
    "    id: `case_${world.flags.caseSeq}`,\n"
    "    day, hour, place: culprit.location || null,\n"
    "    who: victim.name, whoId: victim.id,\n"
    "    against: culprit.name, againstId: culprit.id,\n"
    "    claim: crime, witnesses: [], status: 'filed', verdict: null, petty: true,\n"
    "  });\n"
    "  events.push(nextEvent(world, { action: 'crime', actor: culprit.id, place: culprit.location, payload: { text: `${culprit.name}${crime}` }, isPublic: true }));\n"
    "}\n\n"
    "function markCourtDecree(world) {"
)
if anchor in s2 and 'runPettyCrimes' not in s2:
    s2 = s2.replace(anchor, fn, 1)
    print('added petty crimes')
s2 = s2.replace("  ensureActivity(world);", "  try {\n    runPettyCrimes(world, events);\n  } catch (err) {\n    console.warn('[Case] 民间案子失败：', err.message);\n  }\n\n  ensureActivity(world);", 1)

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
