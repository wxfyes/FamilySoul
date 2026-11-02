import io

# ① 天道可以新增/修改关系
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      } else if (kind === 'hire') {"
inject = (
    "      } else if (kind === 'bond') {\n"
    "        // 天道申报关系：拜把子、认亲、结仇\n"
    "        const aId = resolveActor(world, args.a || args.who);\n"
    "        const bId = resolveActor(world, args.b || args.with);\n"
    "        if (!aId || !bId || aId === bId) continue;\n"
    "        const type = String(args.type || '旧识').slice(0, 6);\n"
    "        const score = Math.max(-100, Math.min(100, Number(args.score) || 20));\n"
    "        world.bonds = world.bonds || {};\n"
    "        world.bonds[aId] = world.bonds[aId] || {};\n"
    "        world.bonds[bId] = world.bonds[bId] || {};\n"
    "        world.bonds[aId][bId] = { type, score };\n"
    "        world.bonds[bId][aId] = { type, score };\n"
    "        applied.push(`关系:${world.actors[aId]?.name}↔${world.actors[bId]?.name} ${type}(${score})`);\n"
    "      } else if (kind === 'hire') {"
)
if anchor in s and "kind === 'bond'" not in s:
    s = s.replace(anchor, inject, 1)
    print('added bond op')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 记账员学会
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old2 = "        '雇人：[[world:hire property=\"运河码头三层大酒楼\" count=3]] —— 说\"雇几个伙计/添人手\"时用；每人每日工钱 0.12 两。',"
new2 = old2 + "\n        '关系：[[world:bond a=aji b=wangpo type=母子 score=40]] —— 剧情里出现认亲、拜把子、结仇时用；score 正为亲近、负为仇怨。',"
if old2 in s2 and 'world:bond' not in s2:
    s2 = s2.replace(old2, new2)
    print('taught bookkeeper bond')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
