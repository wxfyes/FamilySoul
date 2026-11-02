import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 问\"某人在哪\"：直接给准确位置"
add = (
    "    // 府里都有谁：不只玩家该知道，婉儿/芸娘她们彼此也得认得\n"
    "    try {\n"
    "      const wH = loadState(this.dataDir);\n"
    "      const meH = this._viewerActorId ? wH.actors?.[this._viewerActorId] : wH.actors?.husband;\n"
    "      const house = Object.values(wH.actors || {}).filter(\n"
    "        (a) => a && !a.dead && a.id !== 'husband' && (a.household || (meH?.home && a.home === meH.home)),\n"
    "      );\n"
    "      if (house.length) {\n"
    "        const line = house.map((a) => `${a.name}（${a.role || '府中人'}）`).join('、');\n"
    "        contextHint += `（【府中人】${line}——她们是同一座宅子里的人，彼此都认得，绝不许问\"你是谁\"、也不许说\"不认识\"。）\\n`;\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 问\"某人在哪\"：直接给准确位置"
)
if anchor in s and '【府中人】' not in s:
    s = s.replace(anchor, add, 1)
    print('patched: household roster in context')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
