import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

# 1) tick 开头：每次落盘前都把"该开朝议/该排命运"检查一遍
old = "  const elapsed = Math.max(0, now - world.lastRealAt);"
new = (
    "  // 每次心跳都检查：不依赖\"跨点\"，重启也不会错过\n"
    "  try {\n"
    "    markNpcArcs(world);\n"
    "    markCourtDecree(world);\n"
    "  } catch (err) {\n"
    "    console.warn('[World] 标记失败：', err.message);\n"
    "  }\n\n"
    "  const elapsed = Math.max(0, now - world.lastRealAt);"
)
if old in s and '每次心跳都检查' not in s:
    s = s.replace(old, new, 1)
    print('patched: marks before elapsed')

# 2) 即使没有跨点也保存（否则 pending 标记丢了）
old2 = "  if (steps > 0) {\n    world.lastRealAt += steps * msPerWorldHour;"
new2 = "  if (steps > 0 || world.court?.pendingDecree || Object.keys(world.npcArcs || {}).length) {\n    if (steps > 0) world.lastRealAt += steps * msPerWorldHour;"
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: always persist marks')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
