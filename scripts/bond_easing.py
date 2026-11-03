import io

# ① bonds.js：新增"关系改善/恶化"
p = 'src/world/bonds.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'export function shiftBond' not in s:
    s += (
        "\n/** 关系可以变：正在化解的仇，分数往上走；新结的怨，往下走 */\n"
        "export function shiftBond(world, aId, bId, delta) {\n"
        "  if (!aId || !bId || aId === bId) return null;\n"
        "  world.bonds = world.bonds || {};\n"
        "  world.bonds[aId] = world.bonds[aId] || {};\n"
        "  world.bonds[bId] = world.bonds[bId] || {};\n"
        "  const cur = world.bonds[aId][bId] || { type: '旧识', score: 0 };\n"
        "  const next = Math.max(-100, Math.min(100, (Number(cur.score) || 0) + Number(delta || 0)));\n"
        "  const type = cur.type === '仇家' && next > -20 ? '旧识' : cur.type;\n"
        "  world.bonds[aId][bId] = { type, score: next };\n"
        "  world.bonds[bId][aId] = { type, score: next };\n"
        "  return { aId, bId, type, score: next };\n"
        "}\n\n"
        "/** 谁跟谁有仇：怨气一消，关系也跟着松 */\n"
        "export function easeBonds(world, actorId, amount) {\n"
        "  const mine = world.bonds?.[actorId];\n"
        "  if (!mine || !amount) return [];\n"
        "  const changed = [];\n"
        "  for (const [otherId, b] of Object.entries(mine)) {\n"
        "    if (!b || Number(b.score) >= 20) continue; // 只化解不好的关系\n"
        "    const r = shiftBond(world, actorId, otherId, amount);\n"
        "    if (r) changed.push(r);\n"
        "  }\n"
        "  return changed;\n"
        "}\n"
    )
    print('added shiftBond/easeBonds')

io.open(p, 'w', encoding='utf-8').write(s)

# ② dispatch：怨怼下降 → 顺手化解她和别人的仇
p2 = 'src/world/dispatch.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

if 'easeBonds' not in s2:
    s2 = s2.replace(
        "import { propagateMood } from './bonds.js';",
        "import { propagateMood, easeBonds } from './bonds.js';",
    )
    old = "          if (args.field === 'grievance') propagateMood(world, id, delta);"
    new = (
        "          if (args.field === 'grievance') {\n"
        "            propagateMood(world, id, delta);\n"
        "            // 怨气降了，她和别人的仇也松一点（化解要真的生效）\n"
        "            if (delta < 0) {\n"
        "              const eased = easeBonds(world, id, Math.abs(delta) * 0.4);\n"
        "              if (eased.length) applied.push(`关系缓和:${eased.map((x) => `${world.actors[x.bId]?.name || x.bId}→${x.score}`).join('、')}`);\n"
        "            }\n"
        "          }"
    )
    if old in s2:
        s2 = s2.replace(old, new, 1)
        print('patched: easing bonds on grievance drop')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
