import io
# ① pet-service：NPC 代演时把他的底细塞进事实
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'person-facts.js' not in s:
    anchor = "import { placeFacts"
    idx = s.find(anchor)
    if idx < 0:
        idx = s.find("import ")
    # 插在第一个 import 之后
    first = s.find('\n', s.find('import '))
    s = s[:first+1] + "import { personFacts } from './world/person-facts.js';\n" + s[first+1:]
    print('① 引入 personFacts')

old = """              facts: npcFacts.concat([
                herePlaceFact,"""
new = """              facts: npcFacts.concat([
                herePlaceFact,
                personFacts(wPost, npc.id),"""
if old in s:
    s = s.replace(old, new, 1)
    print('② 代演时注入他的底细')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② 她的身份卡也带上本人底细（住处/婚配）
p2 = 'src/world/member-card.js'
d = io.open(p2, encoding='utf-8-sig').read()
if 'personFacts' not in d:
    d = d.replace("import { loadState, worldDate } from './state.js';",
                  "import { loadState, worldDate, placeFacts } from './state.js';\nimport { personFacts } from './person-facts.js';", 1)
    d = d.replace("  lines.push(moneyLine(world, actorId));",
                  "  lines.push(moneyLine(world, actorId));\n  const mine = personFacts(world, actorId);\n  if (mine) lines.push(mine);", 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(d)
    print('③ 她的卡也带底细')
