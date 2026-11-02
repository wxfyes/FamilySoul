import io

p = 'src/world/bonds.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  // ② 同一衙门：同僚\n"
    "  for (const a of actors) {\n"
    "    for (const b of actors) {\n"
    "      if (a.id >= b.id) continue;\n"
    "      if (!OFFICIAL_WORDS.test(String(a.role || '')) || !OFFICIAL_WORDS.test(String(b.role || ''))) continue;\n"
    "      const samePlace = placeOf(world, a.id) && placeOf(world, a.id) === placeOf(world, b.id);\n"
    "      addBond(world, a.id, b.id, '同僚', samePlace ? 25 : 10);\n"
    "    }\n"
    "  }"
)
new = (
    "  // ② 同一衙门：同僚（只连同处办公的，不然 113 个官会连出上万物关系）\n"
    "  const officials = actors.filter((a) => OFFICIAL_WORDS.test(String(a.role || '')));\n"
    "  const byPlace = {};\n"
    "  for (const a of officials) {\n"
    "    const pl = placeOf(world, a.id);\n"
    "    if (!pl) continue;\n"
    "    (byPlace[pl] = byPlace[pl] || []).push(a);\n"
    "  }\n"
    "  for (const group of Object.values(byPlace)) {\n"
    "    if (group.length > 8) continue; // 同处一张桌子的才算同僚\n"
    "    for (let i = 0; i < group.length; i += 1) {\n"
    "      for (let j = i + 1; j < group.length; j += 1) {\n"
    "        addBond(world, group[i].id, group[j].id, '同僚', 25);\n"
    "      }\n"
    "    }\n"
    "  }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: officials same-office only')

# 上限：关系总数不超过 600 条
old2 = "  return world;\n}\n\n/** 关系变动向亲近的人传导"
new2 = (
    "  // 总上限：世界再大，关系也不该无限膨胀\n"
    "  const ids = Object.keys(world.bonds);\n"
    "  let total = 0;\n"
    "  for (const id of ids) total += Object.keys(world.bonds[id] || {}).length;\n"
    "  if (total > 1200) {\n"
    "    // 只保留强关系（|score| >= 15）\n"
    "    for (const id of ids) {\n"
    "      for (const [oid, b] of Object.entries(world.bonds[id] || {})) {\n"
    "        if (Math.abs(Number(b?.score) || 0) < 15) delete world.bonds[id][oid];\n"
    "      }\n"
    "    }\n"
    "  }\n"
    "  return world;\n}\n\n/** 关系变动向亲近的人传导"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: cap total bonds')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
