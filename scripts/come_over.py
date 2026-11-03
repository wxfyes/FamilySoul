import io

p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "  if (hasSummonVerb) {"
add = (
    "  // 「婉儿、芸娘，都过来」→ 点到的人都真的走过来\n"
    "  if (mentioned.length >= 1 && /(过来|都来|叫|唤|请|来一趟|来一下)/.test(say)) {\n"
    "    const movedIn = [];\n"
    "    for (const id of mentioned.slice(0, 3)) {\n"
    "      const a = world.actors[id];\n"
    "      if (!a || a.dead || a.location === me.location) continue;\n"
    "      a.location = me.location;\n"
    "      a.activity = { text: '应声赶来', at: world.clock?.hour || 0, day: world.clock?.day || 1 };\n"
    "      movedIn.push(a.name);\n"
    "    }\n"
    "    if (movedIn.length) {\n"
    "      saveState(dataDir, world);\n"
    "      return { moved: movedIn, summoned: mentioned.map((id) => world.actors[id]?.name).filter(Boolean), visited: null, cameToMe: true };\n"
    "    }\n"
    "  }\n\n"
    "  if (hasSummonVerb) {"
)
if anchor in s and 'cameToMe' not in s:
    s = s.replace(anchor, add, 1)
    print('patched: called actors walk over')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
