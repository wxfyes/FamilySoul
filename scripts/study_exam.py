import io

# ① clock：读书涨学识 + 每 90 天科举 + 每月庙会
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "/** 行会：同行抽成、会首说话有分量 */"
fn = (
    "/** 读书与科举：学识靠读，功名靠考 */\n"
    "function runStudy(world, events) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  const hasAcademy = Boolean(world.places?.academy);\n"
    "  if (!hasAcademy) return;\n"
    "  // 在书院的人，学识每天长一点\n"
    "  for (const a of Object.values(world.actors || {})) {\n"
    "    if (!a || a.dead || a.id === 'husband') continue;\n"
    "    if (a.location !== 'academy') continue;\n"
    "    const cur = Number(a.study) || 0;\n"
    "    a.study = Math.min(100, Math.round((cur + 0.6) * 10) / 10);\n"
    "  }\n"
    "  // 每 90 天乡试：学识最高的几个人里有中的\n"
    "  if (day % 90 !== 0) return;\n"
    "  const candidates = Object.values(world.actors || {})\n"
    "    .filter((a) => a && !a.dead && (Number(a.study) || 0) >= 30)\n"
    "    .sort((a, b) => (Number(b.study) || 0) - (Number(a.study) || 0))\n"
    "    .slice(0, 5);\n"
    "  if (!candidates.length) return;\n"
    "  const winner = candidates[0];\n"
    "  const cur = String(winner.rank || '');\n"
    "  const next = !cur ? '秀才' : cur === '秀才' ? '举人' : cur === '举人' ? '进士' : '进士';\n"
    "  winner.rank = next;\n"
    "  winner.role = `${next}·${String(winner.role || '读书人').replace(/^(秀才|举人|进士)·?/, '')}`;\n"
    "  const rel = winner.relations?.husband || { trust: 30, desire: 0, fear: 0, grievance: 0 };\n"
    "  rel.trust = Math.min(100, (Number(rel.trust) || 30) + 8);\n"
    "  winner.relations = winner.relations || {};\n"
    "  winner.relations.husband = rel;\n"
    "  events.push(nextEvent(world, { action: 'exam', actor: winner.id, place: 'academy', payload: { text: `${winner.name}中${next}` }, isPublic: true }));\n"
    "}\n\n"
    "/** 节庆：每月初一十五庙会，香火旺、街面热闹 */\n"
    "function runFestivals(world, events) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  if (day % 15 !== 0) return;\n"
    "  const tpl = world.places?.temple;\n"
    "  for (const ct of Object.values(world.cities || {})) {\n"
    "    if (!ct) continue;\n"
    "    ct.price = Math.min(300, Math.round((Number(ct.price) || 100) * 1.04));\n"
    "    ct.unrest = Math.max(0, (Number(ct.unrest) || 0) - 2);\n"
    "  }\n"
    "  events.push(nextEvent(world, { action: 'festival', actor: 'monk', place: tpl ? 'temple' : null, payload: { text: '初一庙会，城隍庙前摆满摊子' }, isPublic: true }));\n"
    "  const monkA = world.actors?.monk;\n"
    "  if (monkA) {\n"
    "    const rel = monkA.relations?.husband || { trust: 28, grievance: 0 };\n"
    "    rel.trust = Math.min(100, (Number(rel.trust) || 28) + 1);\n"
    "    monkA.relations = monkA.relations || {};\n"
    "    monkA.relations.husband = rel;\n"
    "  }\n"
    "}\n\n"
    "/** 行会：同行抽成、会首说话有分量 */"
)
if anchor in s and 'runStudy' not in s:
    s = s.replace(anchor, fn, 1)
    print('added study/exam/festival')

s = s.replace("  consumeSupplies(world);", "  try {\n    runStudy(world, events);\n    runFestivals(world, events);\n  } catch (err) {\n    console.warn('[Study] 读书节庆失败：', err.message);\n  }\n  consumeSupplies(world);", 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
