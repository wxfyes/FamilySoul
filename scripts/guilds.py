import io

# ① 行会种子
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    powers: {"
guilds = (
    "    // ── 行会：同行的规矩，不是朝廷立的，是行里人自己立的 ──\n"
    "    guilds: {\n"
    "      chahang: { id: 'chahang', name: '茶行', head: 'qiantonghai', dues: 4, power: 60, note: '茶价由茶行说了算，不入行的茶卖不上价' },\n"
    "      caobang: { id: 'caobang', name: '漕帮', head: 'leiq i', dues: 3, power: 75, note: '码头水运都归漕帮，过船要交例钱' },\n"
    "      tuhang: { id: 'tuhang', name: '屠行', head: 'zhangtu', dues: 2, power: 30, note: '肉案的价格与地盘' },\n"
    "      xiuhang: { id: 'xiuhang', name: '绣行', head: 'suniang', dues: 2, power: 25, note: '绣活派给谁，由绣行分' },\n"
    "      yahang: { id: 'yahang', name: '牙行', head: 'danglaoban', dues: 5, power: 40, note: '买卖居间、当铺赎当都过牙行' },\n"
    "    },\n\n"
    "    powers: {"
)
if anchor in s and 'guilds:' not in s:
    s = s.replace(anchor, guilds, 1)
    print('seeded guilds')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 每天：行会抽成（成员的产业），行会势力微涨
p2 = 'src/world/clock.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

anchor2 = "function consumeSupplies(world) {"
fn = (
    "/** 行会：同行抽成、会首说话有分量 */\n"
    "function runGuilds(world, events) {\n"
    "  world.guilds = world.guilds || {};\n"
    "  for (const g of Object.values(world.guilds)) {\n"
    "    if (!g) continue;\n"
    "    const head = world.actors?.[g.head];\n"
    "    if (head) {\n"
    "      const rel = head.relations?.husband || {};\n"
    "      // 会首对相公越亲近，行会对他的铺子越客气\n"
    "      g.attitude = (Number(rel.trust) || 30) >= 50 ? 'friendly' : (Number(rel.grievance) || 0) >= 30 ? 'hostile' : 'neutral';\n"
    "    }\n"
    "    g.power = Math.max(0, Math.min(100, (Number(g.power) || 30) + (g.attitude === 'friendly' ? 0 : 0.2)));\n"
    "  }\n"
    "  // 茶行每月抽一次：茶坊日入的 dues% 归茶行\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  if (day % 30 !== 0) return;\n"
    "  for (const g of Object.values(world.guilds)) {\n"
    "    if (!g) continue;\n"
    "    const props = (world.assets?.properties || []).filter((p) => p && new RegExp(String(g.name).replace('行', '')).test(String(p.name || '')));\n"
    "    if (!props.length) continue;\n"
    "    const dues = props.reduce((s, p) => s + (Number(p.incomePerDay) || 0) * (Number(g.dues) || 3) / 100, 0);\n"
    "    if (dues <= 0) continue;\n"
    "    world.assets.silver = round2(Math.max(0, (Number(world.assets.silver) || 0) - dues));\n"
    "    events.push(nextEvent(world, { action: 'guild_dues', actor: g.head, place: null, payload: { text: `${g.name}抽成 ${dues.toFixed(2)} 两` }, isPublic: false }));\n"
    "  }\n"
    "}\n\n"
    "function consumeSupplies(world) {"
)
if anchor2 in s2 and 'runGuilds' not in s2:
    s2 = s2.replace(anchor2, fn, 1)
    s2 = s2.replace("  consumeSupplies(world);", "  try {\n    runGuilds(world, events);\n  } catch (err) {\n    console.warn('[Guild] 行会结算失败：', err.message);\n  }\n  consumeSupplies(world);", 1)
    print('wired guilds')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
