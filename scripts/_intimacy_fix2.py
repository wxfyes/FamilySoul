import io
# ① 结算必须"当场点到她"，并留下 lastAt；否则不算成事
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          if (!who || (husbandLoc && who.location && who.location !== husbandLoc)) {"""
new = """          const mentioned = String(say || '').includes(who?.name || '\\u0000')
            || String(activeRole || '').includes(who?.name || '\\u0000')
            || String(activeRole || '').includes(who?.role || '\\u0000');
          if (!who || (husbandLoc && who.location && who.location !== husbandLoc) || !mentioned) {"""
if old in s and 'mentioned' not in s:
    s = s.replace(old, new, 1)
    s = s.replace("""            who.intimacy.consummated = true;""",
"""            who.intimacy.consummated = true;
            who.intimacy.lastAt = Number(wr.clock?.day) || 1;""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 结算加人名与 lastAt')

# ② 一次性清理：成事却从没记过日子的，是误标
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """      // 老城补配套：差事表 + 乡绅/衙役 + 媒婆"""
new2 = """      // 一次性：清掉"成过事却没记日子"的误标（真成事会留 lastAt）
      try {
        if (!world.flags?.intimacyCleanV1) {
          const bad = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a?.intimacy?.consummated) continue;
            if (Number(a.intimacy.lastAt || 0) > 0) continue;
            a.intimacy.consummated = false;
            a.intimacy.level = 0;
            bad.push(a.name);
          }
          world.flags = world.flags || {};
          world.flags.intimacyCleanV1 = { at: Date.now(), cleared: bad };
          if (bad.length) console.log(`[Intimacy] 清理误标：${bad.join('、')}`);
        }
      } catch { /* 忽略 */ }

      // 老城补配套：差事表 + 乡绅/衙役 + 媒婆"""
if old2 in t and 'intimacyCleanV1' not in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 清理误标')
