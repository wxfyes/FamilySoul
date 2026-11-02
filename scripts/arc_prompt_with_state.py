import io

p = 'src/world/arcs.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("export function arcStepPrompt(world, actorId) {")
if start < 0:
    print('WARN: arcStepPrompt not found')
else:
    end = s.find("\n}", start)
    new_fn = (
        "export function arcStepPrompt(world, actorId) {\n"
        "  const arc = world.arcs?.[actorId];\n"
        "  const seed = ARC_SEEDS[actorId];\n"
        "  if (!arc || !seed) return null;\n"
        "  const me = world.actors?.[actorId];\n"
        "  const day = world.clock?.day || 1;\n"
        "  const rel = me?.relations?.husband || {};\n"
        "  const wallet = Number(world.wallets?.[actorId]) || 0;\n"
        "  const props = (world.assets?.properties || []).filter((x) => x && x.keeper === actorId);\n"
        "  const daily = props.reduce((sum, x) => sum + (Number(x.incomePerDay) || 0), 0);\n"
        "  const debts = (world.promises || []).filter((pr) => pr && pr.loan && !pr.done && pr.loan.to === actorId);\n"
        "  const recent = (arc.log || []).slice(-3).map((l) => l.text).filter(Boolean).join('；');\n"
        "  const clues = (world.clues || []).slice(-6).map((c) => String(c.text || '')).filter((t) => t.includes(me?.name || '')).join('；');\n"
        "  return [\n"
        "    `你是天道。人物：${me?.name || ''}（${me?.role || ''}），第${day}日。`,\n"
        "    `她原先的难关：${seed.title}——${seed.hook}。`,\n"
        "    `她现在的处境：账上${wallet.toFixed(2)}两、日入${daily.toFixed(2)}两${props.length ? '（' + props.map((x) => x.name).join('、') + '）' : ''}。`,\n"
        "    debts.length ? `她还欠着：${debts.map((d) => `${d.loan.amount}两`).join('、')}。` : '她没有欠债。',\n"
        "    `她对相公：信任${rel.trust ?? 50}、怨怼${rel.grievance ?? 0}。`,\n"
        "    clues ? `与她有关的线索：${clues}` : '',\n"
        "    recent ? `前情：${recent}。` : '',\n"
        "    '要求：写一句\"眼下正在逼到她眼前的事\"（20~40字）。',\n"
        "    '**如果原来那件事已经被解决（债被平了、人走了、事办完了），就写她眼下新的难处，不要重复旧事、不要假设旧事还在。**',\n"
        "    '只写处境，不写她怎么反应，不写结局。只输出这一句。',\n"
        "  ].filter(Boolean).join('\\n');\n"
        "}"
    )
    s = s[:start] + new_fn + s[end + 2:]
    print('rewrote arcStepPrompt with her finances/debts')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
