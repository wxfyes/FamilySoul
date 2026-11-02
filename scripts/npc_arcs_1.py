import io

# ① arcs.js：NPC 自己的处境提示词
p = 'src/world/arcs.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'npcArcPrompt' not in s:
    s += (
        "\n/** NPC 也有自己的命：给他写一句眼下在逼他的事 */\n"
        "export function npcArcPrompt(world, actorId) {\n"
        "  const a = world?.actors?.[actorId];\n"
        "  if (!a) return null;\n"
        "  const day = world.clock?.day || 1;\n"
        "  const rel = a.relations?.husband || {};\n"
        "  const here = String(world.places?.[a.location]?.name || '');\n"
        "  const arc = (world.npcArcs || {})[actorId] || {};\n"
        "  const prev = arc.lastStep ? `前情：${arc.lastStep}。` : '';\n"
        "  return [\n"
        "    `你是天道。人物：${a.name}（${a.role || ''}），第${day}日，此刻在${here}。`,\n"
        "    `他手头的事：${a.activity?.text || '按部就班'}。`,\n"
        "    `他对相公：信任${rel.trust ?? 30}、怨怼${rel.grievance ?? 0}。`,\n"
        "    prev,\n"
        "    '写一句他眼下自己遇到的麻烦或机会（20~40字），只写处境，不写结局。只输出这一句。',\n"
        "  ].filter(Boolean).join('\\n');\n"
        "}\n"
    )
    print('added npcArcPrompt')
io.open(p, 'w', encoding='utf-8').write(s)

# ② clock.js：每 3 天，给"还在局中"的 NPC 标记要生成自己的事
p2 = 'src/world/clock.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

anchor = "function runSchedules(world) {"
inject = (
    "function markNpcArcs(world) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  if (day % 3 !== 0) return;\n"
    "  world.npcArcs = world.npcArcs || {};\n"
    "  for (const a of Object.values(world.actors || {})) {\n"
    "    if (!a || a.dead || a.id === 'husband') continue;\n"
    "    const rel = a.relations?.husband || {};\n"
    "    const inPlay = (Number(rel.trust) || 0) >= 25 || (Number(rel.grievance) || 0) >= 10;\n"
    "    if (!inPlay) continue;\n"
    "    const arc = world.npcArcs[a.id] || {};\n"
    "    if (arc.pendingStep) continue;\n"
    "    arc.stage = (Number(arc.stage) || 0) + 1;\n"
    "    arc.pendingStep = true;\n"
    "    world.npcArcs[a.id] = arc;\n"
    "  }\n"
    "}\n\n"
    "function runSchedules(world) {"
)
if anchor in s2 and 'markNpcArcs' not in s2:
    s2 = s2.replace(anchor, inject, 1)
    print('added markNpcArcs')
# 在 tick 里调用
s2 = s2.replace("  runSchedules(world);", "  runSchedules(world);\n  try {\n    markNpcArcs(world);\n  } catch (err) {\n    console.warn('[NpcArc] 标记失败：', err.message);\n  }", 1)
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
