import io
# 天亮归位：consentedDay 不是今天 → 回端庄
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：户主关系落到人身上"
add = """      // 天亮归位：只解禁当夜，第二天自动回端庄
      try {
        const dayNow = Number(world.clock?.day) || 1;
        for (const a of Object.values(world.actors || {})) {
          if (!a?.intimacy?.consentedDay) continue;
          if (Number(a.intimacy.consentedDay) === dayNow) continue;
          a.intimacy.ritual = 'solemn';
          a.intimacy.tone = 0;
          delete a.intimacy.consentedDay;
        }
      } catch { /* 忽略 */ }

""" + anchor
if '天亮归位' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('天亮归位')
