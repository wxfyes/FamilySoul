import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "/** 每天：民间案子"
not_found = anchor not in s

fn = (
    "/**\n"
    " * 生老病死：会生、会老、会病、会死，死了产业要有人接。\n"
    " * 只给概率与代价，不写台词。\n"
    " */\n"
    "function runLifecycle(world, events, queuePush) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  world.flags = world.flags || {};\n"
    "\n"
    "  // ① 生子：孕期满 280 天\n"
    "  for (const a of Object.values(world.actors || {})) {\n"
    "    if (!a || a.dead || !a.pregnancy || a.pregnancy.born) continue;\n"
    "    a.pregnancy.days = (Number(a.pregnancy.days) || 0) + 1;\n"
    "    if (a.pregnancy.days < 280) continue;\n"
    "    a.pregnancy.born = true;\n"
    "    const fatherId = a.pregnancy.father || 'husband';\n"
    "    world.flags.npcSeq = (Number(world.flags.npcSeq) || 0) + 1;\n"
    "    const cid = `npc_${world.flags.npcSeq}`;\n"
    "    const isBoy = Math.random() < 0.5;\n"
    "    const surnames = ['王', '沈', '林'];\n"
    "    const sn = surnames[Math.floor(Math.random() * surnames.length)];\n"
    "    world.actors[cid] = {\n"
    "      id: cid, name: `${sn}${isBoy ? '郎' : '娘'}`, role: `${a.name}的${isBoy ? '儿子' : '女儿'}`,\n"
    "      gender: isBoy ? 'male' : 'female', origin: 'spawned',\n"
    "      age: 0, household: true, home: a.home || 'backyard', location: a.home || 'backyard',\n"
    "      parents: [a.id, fatherId],\n"
    "      relations: { husband: { trust: 40, desire: 0, fear: 0, grievance: 0 } },\n"
    "      schedule: [],\n"
    "    };\n"
    "    world.memories = Array.isArray(world.memories) ? world.memories : [];\n"
    "    world.memories.push({ text: `${a.name}生了${isBoy ? '个儿子' : '个女儿'}`, day, at: Date.now(), about: [a.id, 'husband'], visible: 'private' });\n"
    "    events.push(nextEvent(world, { action: 'birth', actor: a.id, place: a.location, payload: { text: `${a.name}添了${isBoy ? '个儿子' : '个女儿'}` }, isPublic: true }));\n"
    "    queuePush?.({ to: 'husband', reason: 'birth', facts: { 生子: a.name }, fallback: `${a.name}生了，母子平安。`, force: true });\n"
    "  }\n"
    "\n"
    "  // ② 衰老与病亡：一年长一岁；过了五十，日子开始咬人\n"
    "  for (const a of Object.values(world.actors || {})) {\n"
    "    if (!a || a.dead || a.id === 'husband') continue;\n"
    "    if (day % 360 === 0) a.age = (Number(a.age) || 20) + 1;\n"
    "    const age = Number(a.age) || 20;\n"
    "    if (age < 45) continue;\n"
    "    const p = Math.min(0.5, (age - 45) * 0.01);\n"
    "    if (Math.random() > p) continue;\n"
    "    a.dead = true;\n"
    "    a.deadDay = day;\n"
    "    a.pendingDeath = true;\n"
    "    events.push(nextEvent(world, { action: 'death', actor: a.id, place: a.location, payload: { text: `${a.name}病故` }, isPublic: true }));\n"
    "    world.memories = Array.isArray(world.memories) ? world.memories : [];\n"
    "    world.memories.push({ text: `${a.name}病故了`, day, at: Date.now(), about: [a.id, 'husband'], visible: 'private' });\n"
    "    queuePush?.({ to: 'husband', reason: 'death', facts: { 丧: a.name }, fallback: `${a.name}去了。`, force: true });\n"
    "  }\n"
    "\n"
    "  // ③ 继承：死人名下的产业，交给配偶或子女\n"
    "  for (const a of Object.values(world.actors || {})) {\n"
    "    if (!a || !a.pendingDeath) continue;\n"
    "    delete a.pendingDeath;\n"
    "    const kids = Object.values(world.actors || {}).filter((x) => x && !x.dead && Array.isArray(x.parents) && x.parents.includes(a.id));\n"
    "    const heir = kids[0] || Object.values(world.actors || {}).find((x) => x && !x.dead && x.id !== a.id && x.home === a.home && x.id !== 'husband');\n"
    "    for (const pr of world.assets?.properties || []) {\n"
    "      if (!pr) continue;\n"
    "      if (pr.owner === a.id) pr.owner = heir ? heir.id : 'husband';\n"
    "      if (pr.keeper === a.id) pr.keeper = heir ? heir.id : 'husband';\n"
    "    }\n"
    "    if (heir) {\n"
    "      events.push(nextEvent(world, { action: 'inherit', actor: heir.id, place: heir.location, payload: { text: `${heir.name}接了${a.name}的产业` }, isPublic: true }));\n"
    "      console.log(`[Life] ${a.name}身后，产业归${heir.name}`);\n"
    "    }\n"
    "  }\n"
    "}\n\n"
)

target_anchor = None
for cand in ["/** 民间案子：民心越乱，案子越多。只记事实，不写过程。 */", "/** 读书与科举：学识靠读，功名靠考 */"]:
    if cand in s:
        target_anchor = cand
        break

if target_anchor is None:
    print('WARN: anchor not found')
else:
    s = s.replace(target_anchor, fn + target_anchor, 1)
    s = s.replace("  consumeSupplies(world);", "  try {\n    runLifecycle(world, events, (o) => queueProactive(world, { type: 'life', ...o }));\n  } catch (err) {\n    console.warn('[Life] 生老病死失败：', err.message);\n  }\n  consumeSupplies(world);", 1)
    print('added lifecycle')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
