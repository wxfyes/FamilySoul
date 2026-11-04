import io, re

def patch(path, pairs, imp=None):
    s = io.open(path, encoding='utf-8-sig').read()
    changed = 0
    for old, new in pairs:
        if old in s:
            s = s.replace(old, new)
            changed += 1
    if imp and imp[0] not in s:
        # 在最后一个 import 之后插入
        m = list(re.finditer(r"^import .*;$", s, re.M))
        if m:
            pos = m[-1].end()
            s = s[:pos] + "\n" + imp[1] + s[pos:]
    io.open(path, 'w', encoding='utf-8').write(s)
    print(f'{path}: 替换 {changed} 处')

# ① clock.js
patch('src/world/clock.js', [
    ("if (p1 && p1.id !== 'husband') p1.location = 'yamen';",
     "if (p1 && p1.id !== 'husband') moveActor(world, p1.id, 'yamen', 'world', '升堂');"),
    ("if (p2 && p2.id !== 'husband') p2.location = 'yamen';",
     "if (p2 && p2.id !== 'husband') moveActor(world, p2.id, 'yamen', 'world', '升堂');"),
    ("        actor.location = slot.place;",
     "        moveActor(world, actor.id, slot.place, 'world', String(slot.do || ''));"),
    ("      if (actor && meetPlace) actor.location = meetPlace;",
     "      if (actor && meetPlace) moveActor(world, actor.id, meetPlace, 'world', '赴约');"),
], ("position.js", "import { moveActor } from './position.js';\n"))

# ② dispatch.js
patch('src/world/dispatch.js', [
    ("        world.actors[id].location = place;",
     "        moveActor(world, id, place, 'ui', '界面');"),
    ("        cActor.location = hus.location;",
     "        moveActor(world, cActor.id, hus.location, 'world', '随行');"),
], ("position.js", "import { moveActor } from './position.js';\n"))

# ③ audit.js
patch('src/world/audit.js', [
    ("        else actor.location = target || 'street';",
     "        else moveActor(world, actor.id, target || 'street', 'world', '自检归位');"),
], ("position.js", "import { moveActor } from './position.js';\n"))

# ④ society.js
patch('src/world/society.js', [
    ("    a.location = placeId;",
     "    const mv = moveActor(world, a.id, placeId, 'world', '天道安顿');\n    if (!mv.ok) continue;"),
], ("position.js", "import { moveActor } from './position.js';\n"))

# ⑤ server.js：界面移动走 'ui'
patch('src/server.js', [
    ("        if (apt.place && world.places?.[apt.place]) {\n              me.location = apt.place;",
     "        if (apt.place && world.places?.[apt.place]) {\n              moveActor(world, me.id, apt.place, 'ui', '赴约');"),
], ("position.js", "import { moveActor } from './position.js';\n"))
