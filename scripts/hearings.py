import io

# clock：到日子就把人传到县衙（差役传唤）
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "/** 民间案子：民心越乱，案子越多。只记事实，不写过程。 */"
fn = (
    "/** 到日子就传人：原告被告押到县衙，开审 */\n"
    "function runHearings(world, events) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  const hour = Number(world.clock?.hour) || 0;\n"
    "  for (const c of world.cases || []) {\n"
    "    if (!c || c.status !== 'summoned') continue;\n"
    "    if (day < Number(c.hearDay || 0)) continue;\n"
    "    if (day === Number(c.hearDay) && hour < Number(c.hearHour || 9)) continue;\n"
    "    const p1 = world.actors?.[c.whoId];\n"
    "    const p2 = world.actors?.[c.againstId];\n"
    "    // 真人被告不硬拽，等他自己去；超过两天缺席审\n"
    "    const husbandParty = c.whoId === 'husband' || c.againstId === 'husband';\n"
    "    const lateDays = day - Number(c.hearDay || day);\n"
    "    if (husbandParty && lateDays < 2) {\n"
    "      const hus = world.actors.husband;\n"
    "      if (!hus || hus.location !== 'yamen') continue;\n"
    "    }\n"
    "    if (p1 && p1.id !== 'husband') p1.location = 'yamen';\n"
    "    if (p2 && p2.id !== 'husband') p2.location = 'yamen';\n"
    "    c.status = 'hearing';\n"
    "    events.push(nextEvent(world, { action: 'hearing', actor: c.againstId, place: 'yamen', payload: { text: `县衙开审：${c.who}告${c.against}` }, isPublic: true }));\n"
    "  }\n"
    "}\n\n"
    "/** 民间案子：民心越乱，案子越多。只记事实，不写过程。 */"
)
if anchor in s and 'runHearings' not in s:
    s = s.replace(anchor, fn, 1)
    print('added hearings')
s = s.replace("  try {\n    runPettyCrimes(world, events);", "  try {\n    runHearings(world, events);\n    runPettyCrimes(world, events);", 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
