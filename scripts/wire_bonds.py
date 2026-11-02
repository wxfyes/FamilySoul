import io

# ① 读档时确保关系网存在
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

if "import { ensureBonds } from './bonds.js';" not in s:
    s = s.replace(
        "import { loadState as _loadState } from './state.js';",
        "import { loadState as _loadState } from './state.js';",
    )
    # 在文件顶部加 import（放在第一个 import 后）
    idx = s.find('import ')
    if idx >= 0:
        s = s[:idx] + "import { ensureBonds } from './bonds.js';\n" + s[idx:]

old = "export function migrateOwnership(world) {"
new = (
    "export function migrateOwnership(world) {\n"
    "  try {\n"
    "    ensureBonds(world);\n"
    "  } catch { /* 关系网失败不影响读档 */ }"
)
if old in s and 'ensureBonds(world)' not in s:
    s = s.replace(old, new, 1)
    print('wired ensureBonds into load')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 她的对话上下文：在场者彼此关系
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

if 'describeBonds' not in s2:
    s2 = s2.replace(
        "import { resolveTurnTarget } from './world/turn-target.js';",
        "import { resolveTurnTarget } from './world/turn-target.js';\nimport { describeBonds } from './world/bonds.js';",
    )
    old2 = "        if (acts.length) bits.push(`他们手头的事：${acts.join('；')}（他们说自己的话时，要跟他们正在做的事对得上）`);"
    new2 = (
        "        if (acts.length) bits.push(`他们手头的事：${acts.join('；')}（他们说自己的话时，要跟他们正在做的事对得上）`);\n"
        "        const hereIds = Object.values(wHere.actors || {})\n"
        "          .filter((a) => a && !a.dead && a.location === locId && a.id !== this._viewerActorId)\n"
        "          .map((a) => a.id);\n"
        "        const bondLines = describeBonds(wHere, hereIds);\n"
        "        if (bondLines.length) bits.push(`他们彼此：${bondLines.join('；')}（他们之间有自己的情分和恩怨，不只围着你转）`);"
    )
    if old2 in s2:
        s2 = s2.replace(old2, new2, 1)
        print('injected bonds into member context')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
