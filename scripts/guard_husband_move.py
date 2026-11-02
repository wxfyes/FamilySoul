import io

p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "export function applySummon(dataDir, text, lastBotSaid = '', selfId = 'husband') {"
new = (
    "export function applySummon(dataDir, text, lastBotSaid = '', selfId = 'husband') {\n"
    "  // 记住相公原本在哪：她走动时绝不顺带把他挪走\n"
    "  const __husbandHome = (() => {\n"
    "    try { return loadState(dataDir)?.actors?.husband?.location || null; } catch { return null; }\n"
    "  })();\n"
    "  const __result = __applySummonInner(dataDir, text, lastBotSaid, selfId);\n"
    "  try {\n"
    "    if (selfId && selfId !== 'husband' && __husbandHome) {\n"
    "      const w2 = loadState(dataDir);\n"
    "      const hus = w2.actors?.husband;\n"
    "      const me = w2.actors?.[selfId];\n"
    "      if (hus && me && hus.location !== __husbandHome && hus.location === me.location) {\n"
    "        hus.location = __husbandHome;\n"
    "        saveState(dataDir, w2);\n"
    "        console.log(`[Scene] 守住：${me.name}走动没有把相公带走（相公仍在原处）`);\n"
    "      }\n"
    "    }\n"
    "  } catch { /* 忽略 */ }\n"
    "  return __result;\n"
    "}\n\n"
    "function __applySummonInner(dataDir, text, lastBotSaid = '', selfId = 'husband') {"
)
if old in s and '__applySummonInner' not in s:
    s = s.replace(old, new, 1)
    print('patched: guard husband location on member moves')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
