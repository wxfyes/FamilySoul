import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 国库 + 粮仓：每天结一次
anchor = "function consumeSupplies(world) {"
fn = (
    "/**\n"
    " * 国库与粮仓：钱和粮都有来处、有去处。\n"
    " *  收：朝廷占的城按税率上缴\n"
    " *  支：官俸（每位在任官）＋军饷（每千兵）＋赈济（灾年）\n"
    " *  空：国库见底 → 朝廷只能加税 → 民心崩\n"
    " *  粮：秋收入库，灾荒出仓；仓越空，粮价越高\n"
    " */\n"
    "function runTreasury(world, events) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  world.court = world.court || {};\n"
    "  const tr = world.court.treasury = world.court.treasury || { silver: 1200, grain: 800, lastIncome: 0, lastExpense: 0 };\n"
    "\n"
    "  // 收：朝廷的城\n"
    "  let income = 0;\n"
    "  for (const ct of Object.values(world.cities || {})) {\n"
    "    if (!ct) continue;\n"
    "    const courtOwned = !ct.owner || ct.owner === 'court';\n"
    "    if (!courtOwned) continue;\n"
    "    const tax = Math.max(0, Math.min(50, Number(ct.tax) || 10));\n"
    "    income += Math.round(((Number(ct.wealth) || 30) * tax) / 100 / 3 * 100) / 100;\n"
    "  }\n"
    "  // 支：官俸 + 军饷\n"
    "  const offices = Object.values(world.court.offices || {}).filter((o) => o && o.holder && !o.vacant);\n"
    "  const salary = offices.length * 1.5;\n"
    "  const mil = world.military || {};\n"
    "  const pay = ((Number(mil.army) || 0) + (Number(mil.militia) || 0) * 0.5) / 100 * 2;\n"
    "  const expense = Math.round((salary + pay) * 100) / 100;\n"
    "\n"
    "  tr.silver = Math.round(((Number(tr.silver) || 0) + income - expense) * 100) / 100;\n"
    "  tr.lastIncome = Math.round(income * 100) / 100;\n"
    "  tr.lastExpense = expense;\n"
    "\n"
    "  // 国库见底：加税或欠俸\n"
    "  if (tr.silver < 0) {\n"
    "    tr.silver = 0;\n"
    "    world.flags = world.flags || {};\n"
    "    world.flags.courtBankrupt = (Number(world.flags.courtBankrupt) || 0) + 1;\n"
    "    for (const ct of Object.values(world.cities || {})) {\n"
    "      if (!ct) continue;\n"
    "      ct.tax = Math.min(50, (Number(ct.tax) || 10) + 2);\n"
    "      ct.unrest = Math.min(100, (Number(ct.unrest) || 0) + 2);\n"
    "    }\n"
    "    events.push(nextEvent(world, { action: 'treasury_empty', actor: 'court', place: null, payload: { text: '国库告罄，朝廷加征' }, isPublic: true }));\n"
    "  }\n"
    "\n"
    "  // 秋收入仓（每 30 天一次），灾荒出仓\n"
    "  if (day % 30 === 0) {\n"
    "    tr.grain = Math.min(3000, (Number(tr.grain) || 0) + 600);\n"
    "    events.push(nextEvent(world, { action: 'harvest', actor: 'court', place: null, payload: { text: '秋收入仓' }, isPublic: true }));\n"
    "  }\n"
    "  const disasters = (events || []).filter((e) => e?.action === 'disaster').length;\n"
    "  if (disasters > 0 && Number(tr.grain) > 0) {\n"
    "    const give = Math.min(Number(tr.grain), disasters * 120);\n"
    "    tr.grain = Number(tr.grain) - give;\n"
    "    for (const ct of Object.values(world.cities || {})) {\n"
    "      if (!ct) continue;\n"
    "      ct.unrest = Math.max(0, (Number(ct.unrest) || 0) - 3);\n"
    "    }\n"
    "    events.push(nextEvent(world, { action: 'relief_grain', actor: 'court', place: null, payload: { text: `开仓放粮 ${give} 石` }, isPublic: true }));\n"
    "  }\n"
    "\n"
    "  // 仓越空，粮价越高\n"
    "  const stock = Number(tr.grain) || 0;\n"
    "  const pressure = stock < 200 ? 1.25 : stock < 500 ? 1.1 : stock > 1500 ? 0.95 : 1;\n"
    "  world.flags = world.flags || {};\n"
    "  world.flags.grainPressure = pressure;\n"
    "}\n\n"
    "function consumeSupplies(world) {"
)
if anchor in s and 'runTreasury' not in s:
    s = s.replace(anchor, fn, 1)
    print('added runTreasury')

s = s.replace("function onNewDay(world, events) {\n  consumeSupplies(world);", "function onNewDay(world, events) {\n  consumeSupplies(world);\n  try {\n    runTreasury(world, events);\n  } catch (err) {\n    console.warn('[Treasury] 国库结算失败：', err.message);\n  }", 1)

# 物价：叠加粮仓压力
s = s.replace(
    "    ct.price = Math.max(50, Math.min(300, Math.round((Number(ct.price) || 100) + drift)));",
    "    ct.price = Math.max(50, Math.min(300, Math.round((Number(ct.price) || 100) + drift)));\n"
    "    const gp = Number(world.flags?.grainPressure) || 1;\n"
    "    if (gp !== 1) ct.price = Math.max(50, Math.min(300, Math.round(ct.price * gp)));",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
