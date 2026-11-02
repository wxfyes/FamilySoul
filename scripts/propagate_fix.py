import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        applied.push(`关系:${actor.name}.${args.field}${delta >= 0 ? '+' : ''}${delta}`);"
new = (
    "        applied.push(`关系:${actor.name}.${args.field}${delta >= 0 ? '+' : ''}${delta}`);\n"
    "        try {\n"
    "          if (args.field === 'grievance') propagateMood(world, id, delta);\n"
    "        } catch { /* 忽略 */ }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: propagate on grievance')
else:
    print('WARN: line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
