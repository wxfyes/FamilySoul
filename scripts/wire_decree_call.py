import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "  runCourtReaction(world, events, (o) => queueProactive(world, { type: 'court', ...o }));"
new = old + ("\n  try {\n    markCourtDecree(world);\n  } catch (err) {\n    console.warn('[Court] 朝议标记失败：', err.message);\n  }")
if old in s and 'markCourtDecree(world);' not in s.split('function markCourtDecree')[1][:800]:
    s = s.replace(old, new, 1)
    print('inserted markCourtDecree call')
else:
    print('skip (already?)')
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
