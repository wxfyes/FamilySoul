import io

p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "  const reply = Array.isArray(world.auditIssues) ? world.auditIssues.slice(-12) : [];"
new = (
    "  // 只留最近两天的台词告警：老账不翻，免得早修好的问题一直挂着\n"
    "  const today = Number(world.clock?.day) || 1;\n"
    "  const reply = Array.isArray(world.auditIssues)\n"
    "    ? world.auditIssues.filter((x) => x && (!x.day || today - Number(x.day) <= 1)).slice(-12)\n"
    "    : [];"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: prune stale reply issues')
else:
    print('WARN: auditAll reply line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
