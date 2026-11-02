import io

# ① 每天扩散
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'spreadRumors' not in s:
    s = s.replace(
        "import { advanceArcs, ensureArcs, resolveArc } from './arcs.js';",
        "import { advanceArcs, ensureArcs, resolveArc } from './arcs.js';\nimport { spreadRumors } from './rumors.js';",
    )
    s = s.replace(
        "function onNewDay(world, events) {\n  consumeSupplies(world);",
        "function onNewDay(world, events) {\n  try {\n    const spread = spreadRumors(world);\n    if (spread.length) console.log(`[Rumor] 传开 ${spread.length} 次`);\n  } catch (err) {\n    console.warn('[Rumor] 扩散失败：', err.message);\n  }\n  consumeSupplies(world);",
        1,
    )
    print('wired rumor spread')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 案子/判决/大事 → 生一条风评
p2 = 'src/server.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

if 'addRumor' not in s2:
    s2 = s2.replace(
        "  async function judgeCases() {",
        "  async function judgeCases() {\n    const { addRumor } = await import('./world/rumors.js');",
    )
    old = "      saveState(DATA_DIR, w3);\n      console.log(`[Court] 判案"
    new = (
        "      try {\n"
        "        addRumor(w3, {\n"
        "          text: `${cc.against}因${cc.claim}被断${cc.verdict === 'guilty' ? '有罪' : '无罪'}`,\n"
        "          about: [cc.againstId, cc.whoId].filter(Boolean),\n"
        "          tone: cc.verdict === 'guilty' ? -1 : 1,\n"
        "          weight: 4,\n"
        "        });\n"
        "      } catch { /* 忽略 */ }\n\n"
        "      saveState(DATA_DIR, w3);\n      console.log(`[Court] 判案"
    )
    if old in s2:
        s2 = s2.replace(old, new, 1)
        print('wired verdict rumor')

io.open(p2, 'w', encoding='utf-8').write(s2)

# ③ 她的对话上下文：谁听过什么
p3 = 'src/pet-service.js'
s3 = io.open(p3, encoding='utf-8-sig').read()

if 'rumorsKnownBy' not in s3:
    s3 = s3.replace(
        "import { describeBonds } from './world/bonds.js';",
        "import { describeBonds } from './world/bonds.js';\nimport { rumorsKnownBy } from './world/rumors.js';",
    )
    old3 = "        if (bondLines.length) {"
    new3 = (
        "        const rumorLines = rumorsKnownBy(wHere, hereIds);\n"
        "        if (rumorLines.length) {\n"
        "          bits.push(`街上在传：${rumorLines.join('；')}（他们可能主动提起，也可能拿这个说事）`);\n"
        "        }\n"
        "        if (bondLines.length) {"
    )
    if old3 in s3:
        s3 = s3.replace(old3, new3, 1)
        print('injected rumors into context')

io.open(p3, 'w', encoding='utf-8').write(s3)
print('ok')
