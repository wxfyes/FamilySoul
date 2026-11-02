import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "/** 行军到达：把兵驻进目标城 */"
fn = (
    "/**\n"
    " * 朝廷围剿：通缉高、占城多，朝廷就会真的派兵来。\n"
    " * 这是\"造反\"的另一半——你占了城，朝廷不会装看不见。\n"
    " */\n"
    "function runImperialCrackdown(world, events, queuePush) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  world.flags = world.flags || {};\n"
    "  const wanted = Number(world.flags.wanted) || 0;\n"
    "  const pressure = Number(world.flags.courtPressure) || 0;\n"
    "  const myCities = Object.entries(world.cities || {}).filter(([, c]) => c && c.owner === 'wangjia');\n"
    "  const threat = wanted * 20 + pressure + myCities.length * 15;\n"
    "\n"
    "  // 已经在路上的朝廷兵马\n"
    "  if (world.imperialArmy) {\n"
    "    const ia = world.imperialArmy;\n"
    "    if (day < Number(ia.arriveDay || 0)) return;\n"
    "    const ct = world.cities?.[ia.target];\n"
    "    if (!ct) { world.imperialArmy = null; return; }\n"
    "    const mil = world.military || {};\n"
    "    const gar = Number(world.garrisons?.[ia.target]) || 0;\n"
    "    const ours = (Number(mil.army) || 0) + (Number(mil.militia) || 0) * 0.6 + gar;\n"
    "    const oursPower = ours * (1 + (Number(mil.morale) || 0) / 200) * (1 + (Number(mil.quality) || 0) / 200);\n"
    "    const theirPower = ia.count * (1 + Math.random() * 0.2);\n"
    "    if (oursPower > theirPower) {\n"
    "      world.flags.wanted = Math.max(0, wanted - 1);\n"
    "      world.flags.courtPressure = Math.max(0, pressure - 20);\n"
    "      mil.morale = Math.min(100, (Number(mil.morale) || 50) + 5);\n"
    "      events.push(nextEvent(world, { action: 'defend_win', actor: 'husband', place: ct.region || null, payload: { text: `击退朝廷${ia.count}兵马` }, isPublic: true }));\n"
    "      queuePush?.({ to: 'husband', reason: 'court', facts: { 官军: '已退' }, fallback: `官军${ia.count}人来攻${ia.target}，被你打退了。`, force: true });\n"
    "    } else {\n"
    "      ct.owner = 'court';\n"
    "      world.flags.wanted = wanted + 1;\n"
    "      mil.army = Math.max(0, Math.round((Number(mil.army) || 0) * 0.7));\n"
    "      mil.morale = Math.max(0, (Number(mil.morale) || 50) - 15);\n"
    "      world.garrisons = world.garrisons || {};\n"
    "      world.garrisons[ia.target] = 0;\n"
    "      events.push(nextEvent(world, { action: 'defend_lose', actor: 'husband', place: ct.region || null, payload: { text: `${ia.target}被官军夺回` }, isPublic: true }));\n"
    "      queuePush?.({ to: 'husband', reason: 'court', facts: { 官军: '城破' }, fallback: `官军破了${ia.target}，你的兵折了大半。`, force: true });\n"
    "    }\n"
    "    world.imperialArmy = null;\n"
    "    return;\n"
    "  }\n"
    "\n"
    "  if (threat < 60) return;\n"
    "  if (Math.random() > Math.min(0.6, threat / 200)) return;\n"
    "  const target = myCities.length ? myCities[0][0] : '临江府';\n"
    "  const count = 40 + Math.round(threat * 0.8);\n"
    "  world.imperialArmy = { count, target, arriveDay: day + 2 };\n"
    "  events.push(nextEvent(world, { action: 'imperial_march', actor: 'court', place: null, payload: { text: `朝廷点${count}兵马来剿` }, isPublic: true }));\n"
    "  queuePush?.({ to: 'husband', reason: 'court', facts: { 官军: '将至' }, fallback: `朝廷点了${count}兵马，两日后到${target}。`, force: true });\n"
    "}\n\n"
    "/** 行军到达：把兵驻进目标城 */"
)
if anchor in s and 'runImperialCrackdown' not in s:
    s = s.replace(anchor, fn, 1)
    s = s.replace("  consumeSupplies(world);", "  try {\n    runImperialCrackdown(world, events, (o) => queueProactive(world, { type: 'court', ...o }));\n  } catch (err) {\n    console.warn('[Court] 围剿失败：', err.message);\n  }\n  consumeSupplies(world);", 1)
    print('added imperial crackdown')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
