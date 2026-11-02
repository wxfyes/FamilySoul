import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "/** 御案上的折子：言官会弹劾地方官 */"
fn = (
    "/** 补缺：位子空了，就从举人里选人补上；没举人就现补一个 */\n"
    "function runAppointments(world, events) {\n"
    "  const offices = world.court?.offices || {};\n"
    "  const vacancies = Object.entries(offices).filter(([, o]) => o && o.vacant);\n"
    "  if (!vacancies.length) return;\n"
    "  const pool = Object.values(world.actors || {}).filter(\n"
    "    (a) => a && !a.dead && a.id !== 'husband' && ['秀才', '举人', '进士'].includes(String(a.rank || '')),\n"
    "  ).sort((x, y) => (Number(y.study) || 0) - (Number(x.study) || 0));\n"
    "  for (const [key, off] of vacancies.slice(0, 2)) {\n"
    "    const pick = pool.find((a) => !a.officeKey);\n"
    "    if (pick) {\n"
    "      pick.officeKey = key;\n"
    "      pick.role = off.title || pick.role;\n"
    "      off.holder = pick.id;\n"
    "      off.vacant = false;\n"
    "      events.push(nextEvent(world, { action: 'appoint', actor: pick.id, place: null, payload: { text: `${pick.name}补${off.title || key}缺` }, isPublic: true }));\n"
    "      continue;\n"
    "    }\n"
    "    // 没人可用：现补一个候补官\n"
    "    const SURNAMES = ['孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗', '郑'];\n"
    "    const sn = SURNAMES[Math.abs(String(key).length * 7 + Number(world.clock?.day || 1)) % SURNAMES.length];\n"
    "    world.flags = world.flags || {};\n"
    "    world.flags.npcSeq = (Number(world.flags.npcSeq) || 0) + 1;\n"
    "    const id = `npc_${world.flags.npcSeq}`;\n"
    "    const title = String(off.title || '地方官');\n"
    "    world.actors[id] = {\n"
    "      id, name: `${sn}${title.slice(0, 2)}`, role: title, gender: 'male', origin: 'spawned',\n"
    "      home: 'yamen', location: 'yamen', officeKey: key, rank: '进士', study: 70,\n"
    "      goals: ['坐稳这个位子'], relations: { husband: { trust: 25, desire: 0, fear: 0, grievance: 0 } },\n"
    "      schedule: [{ at: 9, do: '升堂理事', place: 'yamen' }],\n"
    "    };\n"
    "    off.holder = id;\n"
    "    off.vacant = false;\n"
    "    events.push(nextEvent(world, { action: 'appoint', actor: id, place: 'yamen', payload: { text: `${world.actors[id].name}补${title}缺` }, isPublic: true }));\n"
    "  }\n"
    "}\n\n"
    "/** 御案上的折子：言官会弹劾地方官 */"
)
if anchor in s and 'runAppointments' not in s:
    s = s.replace(anchor, fn, 1)
    s = s.replace("  consumeSupplies(world);", "  try {\n    runAppointments(world, events);\n  } catch (err) {\n    console.warn('[Court] 补缺失败：', err.message);\n  }\n  consumeSupplies(world);", 1)
    print('added appointments')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
