import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'markNpcArcs(world);\n' in s and 'function markNpcArcs' in s and s.count('markNpcArcs(world);') < 2:
    anchor = "  ensureActivity(world);"
    block = (
        "  try {\n"
        "    markNpcArcs(world);\n"
        "    markCourtDecree(world);\n"
        "  } catch (err) {\n"
        "    console.warn('[World] 标记失败：', err.message);\n"
        "  }\n\n"
        "  ensureActivity(world);"
    )
    if anchor in s:
        s = s.replace(anchor, block, 1)
        print('inserted tick-level marks')
    else:
        print('WARN: ensureActivity anchor missing')
else:
    print('skip')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
