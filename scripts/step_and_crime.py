import io

# ① 步进按"上次结算时间"推进，保证每次正好一天
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "    const base = Date.now();\n"
    "    const done = [];\n"
    "    for (let i = 0; i < Math.max(1, Math.min(30, days)); i += 1) {\n"
    "      const before = peek(DATA_DIR).clock?.day || 1;\n"
    "      tick(DATA_DIR, { now: base + (i + 1) * 24 * msPerHour, msPerWorldHour: msPerHour });"
)
new = (
    "    const done = [];\n"
    "    for (let i = 0; i < Math.max(1, Math.min(30, days)); i += 1) {\n"
    "      const before = peek(DATA_DIR).clock?.day || 1;\n"
    "      const last = Number(peek(DATA_DIR).lastRealAt) || Date.now();\n"
    "      tick(DATA_DIR, { now: last + 24 * msPerHour, msPerWorldHour: msPerHour });"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: step advances exactly one day')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 民间案子：一天只查一次，不再死死卡 6 点
p2 = 'src/world/clock.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

old2 = "  if (hour !== 6) return; // 每天卯时"
new2 = (
    "  // 每天只查一次（卯时或之后第一次到）；步进/补算也能触发\n"
    "  if (hour < 6) return;\n"
    "  world.flags = world.flags || {};\n"
    "  if (Number(world.flags.crimeCheckedDay) === day) return;\n"
    "  world.flags.crimeCheckedDay = day;"
)
if old2 in s2:
    s2 = s2.replace(old2, new2, 1)
    print('patched: crime checked once per day')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
