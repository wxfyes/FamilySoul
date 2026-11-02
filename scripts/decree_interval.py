import io

# ① 朝议：改成"距上次下旨满5日就开"，不再靠 day%5
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "function markCourtDecree(world) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  if (day % 5 !== 0) return;\n"
    "  world.court = world.court || {};\n"
    "  if (world.court.pendingDecree) return;\n"
    "  world.court.pendingDecree = true;\n"
    "}"
)
new = (
    "function markCourtDecree(world) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  world.court = world.court || {};\n"
    "  if (world.court.pendingDecree) return;\n"
    "  const last = Number(world.court.lastDecreeDay) || 0;\n"
    "  if (day - last < 5) return;\n"
    "  world.court.pendingDecree = true;\n"
    "}"
)
if old in s:
    s = s.replace(old, new)
    print('patched: decree interval-based')

# ② NPC 命运：按每个人的上次生成日算，不再 day%3
old2 = (
    "function markNpcArcs(world) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  if (day % 3 !== 0) return;"
)
new2 = (
    "function markNpcArcs(world) {\n"
    "  const day = Number(world.clock?.day) || 1;"
)
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: npc arc no day%3 gate')

old3 = (
    "    const arc = world.npcArcs[a.id] || {};\n"
    "    if (arc.pendingStep) continue;\n"
    "    arc.stage = (Number(arc.stage) || 0) + 1;\n"
    "    arc.pendingStep = true;\n"
    "    world.npcArcs[a.id] = arc;"
)
new3 = (
    "    const arc = world.npcArcs[a.id] || {};\n"
    "    if (arc.pendingStep) continue;\n"
    "    const lastDay = Number(arc.day) || 0;\n"
    "    if (lastDay && day - lastDay < 3) continue;\n"
    "    arc.stage = (Number(arc.stage) || 0) + 1;\n"
    "    arc.pendingStep = true;\n"
    "    arc.day = day;\n"
    "    world.npcArcs[a.id] = arc;"
)
if old3 in s:
    s = s.replace(old3, new3)
    print('patched: npc arc per-actor interval')

# ③ 每次心跳都检查（不只跨点）
old4 = "  try {\n    markNpcArcs(world);\n  } catch (err) {\n    console.warn('[NpcArc] 标记失败：', err.message);\n  }"
if old4 in s:
    s = s.replace(old4, "", 1)
anchor = "  ensureActivity(world);"
new5 = (
    "  try {\n"
    "    markNpcArcs(world);\n"
    "    markCourtDecree(world);\n"
    "  } catch (err) {\n"
    "    console.warn('[World] 标记失败：', err.message);\n"
    "  }\n\n"
    "  ensureActivity(world);"
)
if anchor in s and 'markCourtDecree(world);\n  } catch' not in s:
    s = s.replace(anchor, new5, 1)
    print('patched: check every tick')

# ④ applyDecree 记下"上次下旨日"
s = s.replace(
    "  world.court.decisions.push({ day: world.clock?.day || 1, text: String(d?.decree || ''), action: kind, amount });",
    "  world.court.lastDecreeDay = world.clock?.day || 1;\n  world.court.decisions.push({ day: world.clock?.day || 1, text: String(d?.decree || ''), action: kind, amount });",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
