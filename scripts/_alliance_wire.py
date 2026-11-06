import io
# ① 每日巡检时，大户可能来提亲
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { ensureMatchmaker, dailyMarriages } from './marriage.js';",
              "import { ensureMatchmaker, dailyMarriages, maybeOfferAlliance } from './marriage.js';", 1)
old = "      try { dailyMarriages(world); } catch { /* 忽略 */ }"
new = """      try { dailyMarriages(world); } catch { /* 忽略 */ }
      try { maybeOfferAlliance(world); } catch { /* 忽略 */ }"""
if old in s and 'maybeOfferAlliance(world)' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 巡检触发提亲')

# ② 提亲进天道事实 + 应答指令
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { proposeMarriage, isMarriageable } from './world/marriage.js';",
              "import { proposeMarriage, isMarriageable, acceptAlliance, declineAlliance } from './world/marriage.js';", 1)
anchor = "    // 8.79 说亲：话里点名"
add = """    // 8.787 大户提亲：答应或回绝
    try {
      const wA = loadState(this.dataDir);
      const offer = wA.flags?.allianceOffer;
      if (offer && offer.status === 'pending') {
        if (/应了这门亲|答应(这门)?亲事|允了这门亲|就娶她/.test(String(sayText || ''))) {
          const r = acceptAlliance(wA, this._viewerActorId || 'husband');
          saveState(this.dataDir, wA);
          reply += `\\n${r.line}`;
        } else if (/回绝|婉拒|不允|这门亲算了/.test(String(sayText || ''))) {
          const r = declineAlliance(wA);
          saveState(this.dataDir, wA);
          reply += `\\n${r.line}`;
        }
      }
    } catch { /* 忽略 */ }

""" + anchor
if '8.787' not in t:
    t = t.replace(anchor, add, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 应答指令')

# ③ 把提亲作为事实塞给天道
p3 = 'src/pet-service.js'
u = io.open(p3, encoding='utf-8-sig').read()
anchor2 = "    // 此间陈设与可做之事：只给事实，怎么接戏由天道决定"
add2 = """    // 有人来提亲：把这件事摆给天道，让它自然提起
    try {
      const wOf = loadState(this.dataDir);
      const of2 = wOf.flags?.allianceOffer;
      if (of2 && of2.status === 'pending') {
        contextHintEarly += `（【提亲】${of2.familyName}托媒婆来提亲，欲将${of2.girlName}许给相公做侧室。相公若点头，婚事便成；若无意，说一句回绝就是。）\\n`;
      }
    } catch { /* 忽略 */ }

""" + anchor2
if '【提亲】' not in u:
    u = u.replace(anchor2, add2, 1)
    io.open(p3, 'w', encoding='utf-8-sig').write(u)
    print('③ 提亲进事实')
