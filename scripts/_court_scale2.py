import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
# 重名：国库段里改用 courtPressure
s = s.replace("  const pressure = Number(world.flags?.courtPressure) || 0;\n  const skimRate = Math.min(0.35, 0.06 + pressure / 400",
              "  const courtPressure = Number(world.flags?.courtPressure) || 0;\n  const skimRate = Math.min(0.35, 0.06 + courtPressure / 400")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('改名避免冲突')
