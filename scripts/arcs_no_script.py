import io

p = 'src/world/arcs.js'
s = io.open(p, encoding='utf-8-sig').read()

# 1) advanceArcs：不再用写死的 steps，只标记"该天道生成下一步了"
old = (
    "    const stepText = seed.steps[arc.stage];\n"
    "    arc.log = Array.isArray(arc.log) ? arc.log : [];\n"
    "    arc.log.push({ day, text: stepText });\n"
)
new = (
    "    // 不写死下一步：标记由天道现生成（pet-service 在她在场时调模型）\n"
    "    arc.pendingStep = true;\n"
    "    arc.log = Array.isArray(arc.log) ? arc.log : [];\n"
    "    const stepText = arc.lastStep || '（事态在往前走）';\n"
)
if old in s:
    s = s.replace(old, new)
    print('patched: advance no longer uses fixed steps')
else:
    print('WARN: advance step block not found')

# 2) 去掉 atEdge 的写死判定（没有终局）
old2 = (
    "    if (arc.stage >= seed.steps.length - 1) {\n"
    "      if (!arc.atEdge) arc.atEdgeDay = day;\n"
    "      arc.atEdge = true;\n"
    "    }"
)
new2 = (
    "    // 世界没有终局：不设\"最后一步\"，只累积压力\n"
    "    arc.atEdge = (Number(arc.stage) || 0) >= 3; // 仅用于提示\"到了要紧关头\"\n"
)
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: no fixed ending')

# 3) 提供提示词构造函数
add = (
    "\n/** 给天道的一句话提示：根据她现在的处境，说出下一步 */\n"
    "export function arcStepPrompt(world, actorId) {\n"
    "  const arc = world.arcs?.[actorId];\n"
    "  const seed = ARC_SEEDS[actorId];\n"
    "  if (!arc || !seed) return null;\n"
    "  const me = world.actors?.[actorId];\n"
    "  const day = world.clock?.day || 1;\n"
    "  const rel = me?.relations?.husband || {};\n"
    "  const recent = (arc.log || []).slice(-2).map((l) => l.text).filter(Boolean).join('；');\n"
    "  return [\n"
    "    `你是天道。人物：${me?.name || ''}（${me?.role || ''}）。`,\n"
    "    `她的难关：${seed.title}——${seed.hook}。`,\n"
    "    `第${day}日，她对相公：信任${rel.trust ?? 50}、怨怼${rel.grievance ?? 0}。`,\n"
    "    recent ? `前情：${recent}。` : '',\n"
    "    '请写一句\"眼下正在逼到她眼前的事\"（20~40字，只写处境，不写她怎么反应，不写结局）。只输出这一句。',\n"
    "  ].filter(Boolean).join('\\n');\n"
    "}\n"
)
if 'arcStepPrompt' not in s:
    s += add
    print('added arcStepPrompt')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
