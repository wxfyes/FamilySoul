import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  const hasAcademy = Boolean(world.places?.academy);\n"
    "  if (!hasAcademy) return;\n"
    "  // 在书院的人，学识每天长一点"
)
new = (
    "  const hasAcademy = Boolean(world.places?.academy);\n"
    "  if (!hasAcademy) return;\n"
    "  // 每天有几个年轻人去书院：不然永远没人读书，科举就是空的\n"
    "  const youths = Object.values(world.actors || {}).filter(\n"
    "    (a) => a && !a.dead && a.id !== 'husband' && !a.playerControlled && !a.jailed\n"
    "      && !/(知府|知县|尚书|宰相|天子|巡抚|统领|老鸨|帮主)/.test(String(a.role || ''))\n"
    "      && (Number(a.study) || 0) < 95,\n"
    "  );\n"
    "  if (youths.length) {\n"
    "    const go = youths.slice(0, 3);\n"
    "    for (const a of go) {\n"
    "      if (a.location !== 'academy') a.location = 'academy';\n"
    "    }\n"
    "  }\n"
    "  // 在书院的人，学识每天长一点"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: youths attend academy')

# 乡试：人在书院就够，不必卡 90 天一次（但仍按 90 天）
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
