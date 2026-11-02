import io

# ① clock：每 5 天开一次朝议
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "function runCourtReaction(world, events, queuePush) {"
inject = (
    "/** 每 5 天开一次朝议：朝廷要自己下旨，不是只会围剿 */\n"
    "function markCourtDecree(world) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  if (day % 5 !== 0) return;\n"
    "  world.court = world.court || {};\n"
    "  if (world.court.pendingDecree) return;\n"
    "  world.court.pendingDecree = true;\n"
    "}\n\n"
    "/** 把一道旨意落到天下：加税/减税/征役/赈灾/严打/大赦 */\n"
    "export function applyDecree(world, events, d) {\n"
    "  const kind = String(d?.action || 'raise_tax');\n"
    "  const amount = Math.max(0, Math.min(60, Number(d?.amount) || 10));\n"
    "  const cities = Object.values(world.cities || {}).filter(Boolean);\n"
    "  const eff = (fn) => cities.forEach(fn);\n"
    "  if (kind === 'raise_tax') {\n"
    "    eff((c) => { c.tax = Math.min(50, (Number(c.tax) || 10) + Math.round(amount / 2)); c.unrest = Math.min(100, (Number(c.unrest) || 0) + 4); });\n"
    "  } else if (kind === 'lower_tax') {\n"
    "    eff((c) => { c.tax = Math.max(0, (Number(c.tax) || 10) - Math.round(amount / 2)); c.unrest = Math.max(0, (Number(c.unrest) || 0) - 3); });\n"
    "  } else if (kind === 'corvee') {\n"
    "    eff((c) => { c.unrest = Math.min(100, (Number(c.unrest) || 0) + 7); c.price = Math.min(300, Math.round((Number(c.price) || 100) * 1.05)); });\n"
    "  } else if (kind === 'relief') {\n"
    "    eff((c) => { c.unrest = Math.max(0, (Number(c.unrest) || 0) - 8); c.price = Math.max(50, Math.round((Number(c.price) || 100) * 0.9)); });\n"
    "  } else if (kind === 'crackdown') {\n"
    "    eff((c) => { c.unrest = Math.min(100, (Number(c.unrest) || 0) + 3); });\n"
    "  } else if (kind === 'amnesty') {\n"
    "    eff((c) => { c.unrest = Math.max(0, (Number(c.unrest) || 0) - 5); });\n"
    "  }\n"
    "  world.court = world.court || {};\n"
    "  world.court.decisions = Array.isArray(world.court.decisions) ? world.court.decisions : [];\n"
    "  world.court.decisions.push({ day: world.clock?.day || 1, text: String(d?.decree || ''), action: kind, amount });\n"
    "  if (world.court.decisions.length > 30) world.court.decisions = world.court.decisions.slice(-30);\n"
    "  if (Array.isArray(events)) {\n"
    "    events.push(nextEvent(world, {\n"
    "      action: 'decree',\n"
    "      actor: 'court',\n"
    "      place: null,\n"
    "      payload: { text: String(d?.decree || '朝廷下旨') },\n"
    "      isPublic: true,\n"
    "    }));\n"
    "  }\n"
    "  return kind;\n"
    "}\n\n"
    "function runCourtReaction(world, events, queuePush) {"
)
if anchor in s and 'markCourtDecree' not in s:
    s = s.replace(anchor, inject, 1)
    print('added decree machinery')

s = s.replace(
    "  runCourtReaction(world, events, queuePush);",
    "  runCourtReaction(world, events, queuePush);\n  try {\n    markCourtDecree(world);\n  } catch (err) {\n    console.warn('[Court] 朝议标记失败：', err.message);\n  }",
    1,
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
