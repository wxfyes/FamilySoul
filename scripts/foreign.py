import io

# ① 邻国种子
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    powers: {"
foreign = (
    "    // ── 邻国：中原之外，还有别人 ──\n"
    "    foreign: {\n"
    "      beidi: { id: 'beidi', name: '北狄', relation: 45, army: 800, kind: '游牧', wants: '绢帛与铁器' },\n"
    "      nanzhao: { id: 'nanzhao', name: '南诏', relation: 60, army: 400, kind: '山地', wants: '盐与茶' },\n"
    "      dongying: { id: 'dongying', name: '东瀛', relation: 55, army: 200, kind: '海邦', wants: '书籍与瓷器' },\n"
    "    },\n\n"
    "    powers: {"
)
if anchor in s and 'foreign:' not in s:
    s = s.replace(anchor, foreign, 1)
    print('seeded foreign powers')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 每天：关系漂移、边患、使节
p2 = 'src/world/clock.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

anchor2 = "/**\n * 朝廷围剿：通缉高、占城多，朝廷就会真的派兵来。"
fn = (
    "/** 外交：邻国有自己的算盘 */\n"
    "function runForeign(world, events, queuePush) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  const f = world.foreign || {};\n"
    "  const list = Object.values(f).filter(Boolean);\n"
    "  if (!list.length) return;\n"
    "  for (const n of list) {\n"
    "    n.relation = Math.max(0, Math.min(100, (Number(n.relation) || 50) + (Math.random() < 0.5 ? -1 : 1)));\n"
    "  }\n"
    "  // 边患：关系差的国家会来抢边城\n"
    "  if (day % 3 === 0) {\n"
    "    const foe = list.filter((n) => (Number(n.relation) || 50) < 40).sort((a, b) => a.relation - b.relation)[0];\n"
    "    if (foe && Math.random() < 0.5) {\n"
    "      const cities = Object.values(world.cities || {}).filter(Boolean);\n"
    "      const edge = cities[Math.floor(Math.random() * cities.length)];\n"
    "      if (edge) {\n"
    "        const loss = Math.round((Number(edge.wealth) || 30) * 0.08 * 100) / 100;\n"
    "        edge.wealth = Math.max(0, Math.round(((Number(edge.wealth) || 30) - loss) * 100) / 100);\n"
    "        edge.unrest = Math.min(100, (Number(edge.unrest) || 0) + 5);\n"
    "        events.push(nextEvent(world, { action: 'border_raid', actor: 'court', place: edge.region || null, payload: { text: `${foe.name}犯边，${edge.name}被掠` }, isPublic: true }));\n"
    "        queuePush?.({ to: 'husband', reason: 'court', facts: { 边患: foe.name }, fallback: `${foe.name}犯边，${edge.name}被抢了。`, force: true });\n"
    "      }\n"
    "    }\n"
    "  }\n"
    "  // 使节：每 20 天可能来一个\n"
    "  if (day % 20 === 0 && !world.envoy) {\n"
    "    const who = list[Math.floor(Math.random() * list.length)];\n"
    "    const demands = ['纳贡', '通商', '和亲', '借道'];\n"
    "    const demand = demands[Math.floor(Math.random() * demands.length)];\n"
    "    world.envoy = { from: who.id, name: who.name, demand, arriveDay: day + 1, decided: false };\n"
    "    events.push(nextEvent(world, { action: 'envoy', actor: 'court', place: null, payload: { text: `${who.name}遣使，求${demand}` }, isPublic: true }));\n"
    "    queuePush?.({ to: 'husband', reason: 'court', facts: { 使节: who.name }, fallback: `${who.name}的使节到了，说是要${demand}。`, force: true });\n"
    "  }\n"
    "}\n\n"
    "/**\n * 朝廷围剿：通缉高、占城多，朝廷就会真的派兵来。"
)
if anchor2 in s2 and 'runForeign' not in s2:
    s2 = s2.replace(anchor2, fn, 1)
    s2 = s2.replace("  consumeSupplies(world);", "  try {\n    runForeign(world, events, (o) => queueProactive(world, { type: 'court', ...o }));\n  } catch (err) {\n    console.warn('[Foreign] 外交失败：', err.message);\n  }\n  consumeSupplies(world);", 1)
    print('added foreign affairs')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
