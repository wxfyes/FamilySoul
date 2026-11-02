import io

# ① 行军：派兵去某城
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      } else if (kind === 'siege') {"
inject = (
    "      } else if (kind === 'march') {\n"
    "        // 行军：分兵去某城，若干日后到\n"
    "        const to = String(args.to || args.city || '').trim();\n"
    "        const count = Math.max(1, Math.round(Number(args.count) || 0));\n"
    "        if (!to || !count) continue;\n"
    "        const f = forceOf(world, 'husband');\n"
    "        const have = Number(f.army) || 0;\n"
    "        if (have < count) { applied.push(`行军失败:只有${have}兵`); continue; }\n"
    "        const mile = Number(args.days) > 0 ? Number(args.days) : 2;\n"
    "        f.army = have - count;\n"
    "        world.marches = Array.isArray(world.marches) ? world.marches : [];\n"
    "        world.flags = world.flags || {};\n"
    "        world.flags.marchSeq = (Number(world.flags.marchSeq) || 0) + 1;\n"
    "        const arriveDay = (Number(world.clock.day) || 1) + mile;\n"
    "        world.marches.push({ id: `march_${world.flags.marchSeq}`, to, count, arriveDay, from: world.actors?.husband?.location || null });\n"
    "        applied.push(`行军:${count}兵→${to}，${mile}日后到`);\n"
    "      } else if (kind === 'siege') {"
)
if anchor in s and "kind === 'march'" not in s:
    s = s.replace(anchor, inject, 1)
    print('added march op')

# ② 攻城：输赢都要死人
old = "      } else if (kind === 'siege') {"
if old in s:
    pass

io.open(p, 'w', encoding='utf-8').write(s)

# ③ clock：行军的兵到达 → 变成驻军；行军途中吃粮
p2 = 'src/world/clock.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

anchor2 = "/** 山贼流寇：民心乱的城，会被抢。有兵才有太平。 */"
fn = (
    "/** 行军到达：把兵驻进目标城 */\n"
    "function runMarches(world, events) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  if (!Array.isArray(world.marches) || !world.marches.length) return;\n"
    "  world.garrisons = world.garrisons && typeof world.garrisons === 'object' ? world.garrisons : {};\n"
    "  world.marches = world.marches.filter((m) => {\n"
    "    if (!m) return false;\n"
    "    if (day < Number(m.arriveDay || 0)) return true;\n"
    "    world.garrisons[m.to] = (Number(world.garrisons[m.to]) || 0) + (Number(m.count) || 0);\n"
    "    events.push(nextEvent(world, { action: 'march_in', actor: 'husband', place: null, payload: { text: `${m.count}兵抵${m.to}` }, isPublic: true }));\n"
    "    return false;\n"
    "  });\n"
    "}\n\n"
    "/** 山贼流寇：民心乱的城，会被抢。有兵才有太平。 */"
)
if anchor2 in s2 and 'runMarches' not in s2:
    s2 = s2.replace(anchor2, fn, 1)
    s2 = s2.replace("  consumeSupplies(world);", "  try {\n    runMarches(world, events);\n  } catch (err) {\n    console.warn('[March] 行军失败：', err.message);\n  }\n  consumeSupplies(world);", 1)
    print('added marches')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
