import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  const mergedActors = { ...base.actors };\n"
    "  for (const [id, actor] of Object.entries(raw.actors || {})) {\n"
    "    mergedActors[id] = { ...(base.actors?.[id] || {}), ...actor };\n"
    "  }"
)
new = (
    "  // 线上已经有人叫这个名字（比如天道造过「陈郎中」），就别再塞一个预设的同名\n"
    "  const liveNames = new Set(Object.values(raw.actors || {}).map((a) => String(a?.name || '')).filter(Boolean));\n"
    "  const mergedActors = {};\n"
    "  for (const [id, a] of Object.entries(base.actors || {})) {\n"
    "    if (!raw.actors?.[id] && liveNames.has(String(a?.name || ''))) continue;\n"
    "    mergedActors[id] = a;\n"
    "  }\n"
    "  for (const [id, actor] of Object.entries(raw.actors || {})) {\n"
    "    mergedActors[id] = { ...(base.actors?.[id] || {}), ...actor };\n"
    "  }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: skip same-name seed actor')
else:
    print('WARN: merge block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
