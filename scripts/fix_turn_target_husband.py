import io

p = 'src/world/turn-target.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  // ① 她点了谁的名（在场的才算）\n"
    "  const named = here.find((a) => a.name && said.includes(a.name));"
)
new = (
    "  // ⓪ 点王甯的名：不管他在哪都应声\n"
    "  const hus = actors.husband;\n"
    "  if (hus && /(王甯|王掌柜|少掌柜)/.test(said)) {\n"
    "    return { kind: 'husband', actorId: 'husband', named: true };\n"
    "  }\n\n"
    "  // ① 她点了谁的名（在场的才算）\n"
    "  const named = here.find((a) => a.name && said.includes(a.name));"
)
if old in s:
    s = s.replace(old, new)
    print('patched: husband name priority')

s = s.replace(
    "  if (/(你|您)/.test(said) && here.length <= 1) {\n    const hus = actors.husband;\n    if (hus) return { kind: 'husband', actorId: 'husband', named: false };\n  }",
    "  if (/(你|您)/.test(said) && here.length <= 1) {\n    if (hus) return { kind: 'husband', actorId: 'husband', named: false };\n  }",
)
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
