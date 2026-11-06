import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：被暗号误结算的侧室，亲密状态归零"
add = """      // 一次性：娶进来的小姐/才女，名分改成侧室（不再是"小姐"）
      try {
        if (!world.flags?.rankNameFixV1) {
          const fixed = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (String(a.spouse || '') !== 'husband') continue;
            if (!/小姐|才女|姑娘/.test(String(a.role || ''))) continue;
            fixed.push(`${a.name}：${a.role}→侧室`);
            a.role = '侧室';
            a.title = '侧室';
            a.marital = 'concubine';
          }
          world.flags = world.flags || {};
          world.flags.rankNameFixV1 = { at: Date.now(), fixed };
          if (fixed.length) console.log(`[Rank] 名分改正：${fixed.join('、')}`);
        }
      } catch { /* 忽略 */ }

"""
if 'rankNameFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('名分改正')
