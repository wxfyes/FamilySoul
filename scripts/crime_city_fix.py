import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  const worst = cities.slice().sort((a, b) => (Number(b.unrest) || 0) - (Number(a.unrest) || 0))[0];\n"
    "  world.flags = world.flags || {};\n"
    "  if (!world.flags.pendingCase) world.flags.pendingCase = { city: worst.name || '', day };"
)
new = (
    "  // 城市是按「名字」做 key 的，对象里不一定有 name 字段\n"
    "  const entries = Object.entries(world.cities || {}).filter(([, c]) => c && !c.dead);\n"
    "  const worst = entries.sort((x, y) => (Number(y[1].unrest) || 0) - (Number(x[1].unrest) || 0))[0];\n"
    "  if (!worst) return;\n"
    "  const worstName = String(worst[1].name || worst[0] || '');\n"
    "  world.flags = world.flags || {};\n"
    "  if (!world.flags.pendingCase || !world.flags.pendingCase.city) {\n"
    "    world.flags.pendingCase = { city: worstName, day };\n"
    "  }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: city name from key')

# 清掉历史上空的 pendingCase
old2 = "  if (hour < 6) return;\n  world.flags = world.flags || {};"
new2 = (
    "  if (hour < 6) return;\n"
    "  world.flags = world.flags || {};\n"
    "  if (world.flags.pendingCase && !world.flags.pendingCase.city) world.flags.pendingCase = null;"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: clear empty pending case')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
