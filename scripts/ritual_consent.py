import io

p = 'src/world/ritual.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  const actor = world.actors[actorId];\n"
    "  actor.intimacy = actor.intimacy || { level: 2, tone: 0, lastAt: 0, ritual: 'solemn' };\n"
    "  const events = [];\n"
    "\n"
    "  if (hit.unlock) {"
)
new = (
    "  const actor = world.actors[actorId];\n"
    "  actor.intimacy = actor.intimacy || { level: 2, tone: 0, lastAt: 0, ritual: 'solemn' };\n"
    "  const events = [];\n"
    "\n"
    "  // 她可以不愿意：信任不够、心里有怨，就不接这个暗号\n"
    "  if (hit.unlock) {\n"
    "    const rel = actor.relations?.husband || {};\n"
    "    const trust = Number(rel.trust ?? 30);\n"
    "    const grievance = Number(rel.grievance ?? 0);\n"
    "    if (trust < 55 || grievance >= 30) {\n"
    "      rel.grievance = Math.min(100, grievance + 3);\n"
    "      actor.relations = actor.relations || {};\n"
    "      actor.relations.husband = rel;\n"
    "      events.push(nextEvent(world, { actor: actorId, action: 'ritual_refused', payload: { actorId, trust }, isPublic: false }));\n"
    "      saveState(dataDir, world);\n"
    "      appendEvents(dataDir, events);\n"
    "      return {\n"
    "        unlock: false,\n"
    "        finish: false,\n"
    "        refused: true,\n"
    "        actorId,\n"
    "        reason: `${actor.name}不愿意（信任 ${Math.round(trust)}，怨怼 ${Math.round(grievance)}）`,\n"
    "      };\n"
    "    }\n"
    "  }\n"
    "\n"
    "  if (hit.unlock) {"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: she can refuse')
else:
    print('WARN: unlock block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
