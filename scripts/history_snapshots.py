import io

# ① 每日快照：民心 / 物价 / 国库（趋势用）
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "function onNewDay(world, events) {"
fn = (
    "function recordHistory(world) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  world.history = Array.isArray(world.history) ? world.history : [];\n"
    "  if (world.history.some((h) => h && h.day === day)) return;\n"
    "  const cities = Object.values(world.cities || {}).filter(Boolean);\n"
    "  const unrest = cities.length ? Math.round(cities.reduce((a, c) => a + (Number(c.unrest) || 0), 0) / cities.length) : 0;\n"
    "  const price = cities.length ? Math.round(cities.reduce((a, c) => a + (Number(c.price) || 100), 0) / cities.length) : 100;\n"
    "  world.history.push({\n"
    "    day,\n"
    "    unrest,\n"
    "    price,\n"
    "    treasury: Math.round(Number(world.court?.treasury?.silver) || 0),\n"
    "    grain: Math.round(Number(world.court?.treasury?.grain) || 0),\n"
    "    silver: Math.round(Number(world.assets?.silver) || 0),\n"
    "  });\n"
    "  if (world.history.length > 40) world.history = world.history.slice(-40);\n"
    "}\n\n"
    "function onNewDay(world, events) {\n  try { recordHistory(world); } catch (e) { /* 忽略 */ }"
)
if anchor in s and 'recordHistory' not in s:
    s = s.replace(anchor, fn, 1)
    print('added history snapshots')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 看板数据：官员 id、历史、产业明细
p2 = 'src/server.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

if 'officeHolders' not in s2:
    old = "        bondEdges: (() => {"
    new = (
        "        officeHolders: Object.values(world.court?.offices || {}).map((o) => o && o.holder).filter(Boolean),\n"
        "        history: (world.history || []).slice(-14),\n"
        "        bondEdges: (() => {"
    )
    if old in s2:
        s2 = s2.replace(old, new, 1)
        print('added officeHolders/history to payload')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
