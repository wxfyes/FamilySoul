import io
# ① apply 的门禁认"放行条"
p = 'src/world/apply.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { materializeRoom } from './residence.js';",
              "import { materializeRoom } from './residence.js';\nimport { hasPass } from './visit.js';", 1)
old = """          const invited = Boolean(actor.invitedBy && actor.invitedBy === owner);"""
new = """          const invited = Boolean(actor.invitedBy && actor.invitedBy === owner) || hasPass(world, meId, parentId2);"""
if old in s:
    s = s.replace(old, new, 1)
    s = s.replace("""      try {
        const dest = world.places?.[finalTargetId];""",
"""      try {
        const dest = world.places?.[finalTargetId];
        const parentId2 = dest?.parent || (dest?.residence ? dest.id : '');""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① apply 认放行条')

# ② go：被门禁拦住时，先叫门（递帖—通禀—允入）
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { describeRoom, roomForHour } from './world/room-life.js';",
              "import { describeRoom, roomForHour } from './world/room-life.js';\nimport { knock, grantPass, residenceOf } from './world/visit.js';", 1)
old2 = """          if (person && world.places?.[person.location]) target = person.location;
        }"""
new2 = """          if (person && world.places?.[person.location]) target = person.location;
        }
        // 叫门：要去的是别人的内院，先在门口递帖，允了才进
        let knockLine = '';
        {
          const dest = world.places?.[target];
          const home = dest ? residenceOf(world, dest.id) : null;
          if (home && home.id !== target && String(home.owner || '') !== actorId) {
            const verdict = knock(world, actorId, home.id);
            if (!verdict.allowed) {
              knockLine = `（${verdict.reason}）`;
              target = world.places?.[home.id]?.rooms?.gate?.id || home.id;
            } else {
              grantPass(world, actorId, home.id, world.clock?.day);
              if (verdict.place) target = verdict.place;
              knockLine = `（${verdict.reason}）`;
            }
          }
        }"""
if old2 in t and '叫门：要去的是别人的内院' in new2:
    t = t.replace(old2, new2, 1)
    # 把门房的话并进返回行
    t = t.replace("""        return sendJson(res, 200, { ok: true, applied: res2.ok, place: placeName2,""",
"""        if (knockLine && res2.ok) {
          try { res2.line = `${knockLine}${String(res2.line || '')}`; } catch { /* 忽略 */ }
        }
        return sendJson(res, 200, { ok: true, applied: res2.ok, place: placeName2,""", 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② go 里加叫门')
