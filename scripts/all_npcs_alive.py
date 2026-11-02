import io

# ① 所有活人都有命：不再只看信任/怨怼
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "    const rel = a.relations?.husband || {};\n"
    "    const inPlay = (Number(rel.trust) || 0) >= 25 || (Number(rel.grievance) || 0) >= 10;\n"
    "    if (!inPlay) continue;"
)
new = (
    "    if (a.servant && !a.name) continue;\n"
    "    // 世界里每个活人都有自己的事，不再只挑\"局中人\"\n"
    "    if (!a.role && !a.schedule?.length) continue;"
)
if old in s:
    s = s.replace(old, new)
    print('patched: all living npcs')
else:
    print('WARN: inPlay block not found')

# ② 没有日程的人，也给一句默认手头事（否则永远是空的）
old2 = "function runSchedules(world) {"
new2 = (
    "function ensureActivity(world) {\n"
    "  for (const a of Object.values(world.actors || {})) {\n"
    "    if (!a || a.dead || a.id === 'husband') continue;\n"
    "    if (a.activity?.text) continue;\n"
    "    const role = String(a.role || '');\n"
    "    let text = '忙着手里的事';\n"
    "    if (/知府|知县/.test(role)) text = '坐堂理事，批折子';\n"
    "    else if (/尚书|宰相/.test(role)) text = '在衙门里议事';\n"
    "    else if (/天子/.test(role)) text = '在宫里听政';\n"
    "    else if (/掌柜|东家|老板娘/.test(role)) text = '守着铺子看账';\n"
    "    else if (/工头|匠/.test(role)) text = '在工地上盯活';\n"
    "    else if (/行商|商/.test(role)) text = '在外头跑买卖';\n"
    "    else if (/伙计|跑堂/.test(role)) text = '招呼客人';\n"
    "    else if (/护卫|统领|兵/.test(role)) text = '当值巡街';\n"
    "    else if (/寡妇|绣|妇人/.test(role)) text = '在家做针线';\n"
    "    a.activity = { text, at: world.clock?.hour || 0, day: world.clock?.day || 1 };\n"
    "  }\n"
    "}\n\n"
    "function runSchedules(world) {"
)
if old2 in s and 'ensureActivity' not in s:
    s = s.replace(old2, new2, 1)
    print('added ensureActivity')
s = s.replace("  runSchedules(world);", "  ensureActivity(world);\n  runSchedules(world);", 1)

io.open(p, 'w', encoding='utf-8').write(s)

# ③ 每次心跳多补几个，把积压清掉
p2 = 'src/server.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old3 = "      for (let round = 0; round < 2; round += 1) {"
new3 = "      for (let round = 0; round < 5; round += 1) {"
if old3 in s2:
    s2 = s2.replace(old3, new3)
    print('patched: 5 npc arcs per tick')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
