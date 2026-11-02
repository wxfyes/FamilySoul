import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("  const cities = Object.values(world.cities || {}).filter(Boolean);\n  const avgUnrest")
end = s.find("}\n\nfunction markCourtDecree")
if start < 0 or end < 0:
    print('WARN: crime block not found')
else:
    new_block = (
        "  const cities = Object.values(world.cities || {}).filter(Boolean);\n"
        "  if (!cities.length) return;\n"
        "  const avgUnrest = cities.reduce((s, c) => s + (Number(c.unrest) || 0), 0) / cities.length;\n"
        "  const p = 0.2 + Math.min(0.4, avgUnrest / 200);\n"
        "  if (Math.random() > p) return;\n"
        "  // 只决定\"哪座城出了事\"，案情由天道现写\n"
        "  const worst = cities.slice().sort((a, b) => (Number(b.unrest) || 0) - (Number(a.unrest) || 0))[0];\n"
        "  world.flags = world.flags || {};\n"
        "  if (!world.flags.pendingCase) world.flags.pendingCase = { city: worst.name || '', day };\n"
    )
    s = s[:start] + new_block + s[end:]
    print('patched: crimes become pendingCase')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
