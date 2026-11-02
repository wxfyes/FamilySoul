import io

# ① 招兵要花钱
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        const who = String(args.who || 'husband');\n"
    "        const f = forceOf(world, who);\n"
    "        f[field] = Math.max(0, (Number(f[field]) || 0) + delta);\n"
    "        applied.push(`${field}${delta >= 0 ? '+' : ''}${delta}→${f[field]}`);"
)
new = (
    "        const who = String(args.who || 'husband');\n"
    "        const f = forceOf(world, who);\n"
    "        // 招兵要发饷：正兵 3 两/人，乡勇 1 两，护院 2 两\n"
    "        const unit = field === 'army' ? 3 : field === 'militia' ? 1 : 2;\n"
    "        if (delta > 0) {\n"
    "          const cost = Math.round(delta * unit * 100) / 100;\n"
    "          const purse = Number(world.assets.silver) || 0;\n"
    "          if (purse < cost) {\n"
    "            applied.push(`招兵失败:需${cost}两，账上只有${purse}两`);\n"
    "            continue;\n"
    "          }\n"
    "          world.assets.silver = round2(purse - cost);\n"
    "          applied.push(`招兵花费${cost}两`);\n"
    "        }\n"
    "        f[field] = Math.max(0, (Number(f[field]) || 0) + delta);\n"
    "        applied.push(`${field}${delta >= 0 ? '+' : ''}${delta}→${f[field]}`);"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: troops cost money')
else:
    print('WARN: troops block not found')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 山贼流寇：民心乱的城会被抢
p2 = 'src/world/clock.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

anchor = "/** 读书与科举：学识靠读，功名靠考 */"
fn = (
    "/** 山贼流寇：民心乱的城，会被抢。有兵才有太平。 */\n"
    "function runBandits(world, events) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  if (day % 2 !== 0) return; // 隔日可能出事\n"
    "  const cities = Object.values(world.cities || {}).filter(Boolean);\n"
    "  if (!cities.length) return;\n"
    "  const hot = cities.filter((c) => (Number(c.unrest) || 0) >= 45);\n"
    "  if (!hot.length) return;\n"
    "  if (Math.random() > 0.35) return;\n"
    "  const ct = hot[Math.floor(Math.random() * hot.length)];\n"
    "  const mine = ct.owner === 'wangjia';\n"
    "  const mil = world.military || {};\n"
    "  const guards = mine ? ((Number(mil.army) || 0) + (Number(mil.militia) || 0) + (Number(mil.guards) || 0)) : 0;\n"
    "  const defense = (Number(ct.defense) || 10) * 12 + guards;\n"
    "  const raiders = 20 + Math.floor(Math.random() * 60);\n"
    "  if (defense >= raiders * 4) {\n"
    "    if (mine && guards > 0) {\n"
    "      world.military.morale = Math.max(0, (Number(world.military.morale) || 50) - 2);\n"
    "      world.military.supplies = Math.max(0, (Number(world.military.supplies) || 0) - 2);\n"
    "      events.push(nextEvent(world, { action: 'repelled', actor: 'husband', place: null, payload: { text: `${ct.name}击退一股流寇` }, isPublic: true }));\n"
    "    }\n"
    "    return;\n"
    "  }\n"
    "  const loss = Math.round((Number(ct.wealth) || 30) * (mine ? 0.12 : 0.06) * 100) / 100;\n"
    "  ct.wealth = Math.max(0, Math.round(((Number(ct.wealth) || 30) - loss) * 100) / 100);\n"
    "  ct.unrest = Math.min(100, (Number(ct.unrest) || 0) + 6);\n"
    "  events.push(nextEvent(world, { action: 'bandits', actor: 'system', place: ct.region || null, payload: { text: `${ct.name}遭流寇劫掠，损${loss}两` }, isPublic: true }));\n"
    "  if (mine) {\n"
    "    world.military = world.military || {};\n"
    "    world.military.morale = Math.max(0, (Number(world.military.morale) || 50) - 8);\n"
    "    world.military.army = Math.max(0, Math.round((Number(world.military.army) || 0) * 0.92));\n"
    "  }\n"
    "}\n\n"
    "/** 读书与科举：学识靠读，功名靠考 */"
)
if anchor in s2 and 'runBandits' not in s2:
    s2 = s2.replace(anchor, fn, 1)
    s2 = s2.replace("  consumeSupplies(world);", "  try {\n    runBandits(world, events);\n  } catch (err) {\n    console.warn('[Bandit] 流寇失败：', err.message);\n  }\n  consumeSupplies(world);", 1)
    print('added bandits')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
