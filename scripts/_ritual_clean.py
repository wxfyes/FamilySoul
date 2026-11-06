import io
# ③ 清理：阶级人物被暗号误标"已欢好"的，全部归零（他们没有真入过府）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：阶级人物被误标成\"相公府里人\""
add = """      // 一次性：城里阶级人物被暗号误结算成"相好"的，归零
      try {
        if (!world.flags?.classIntimacyFixV1) {
          const cleared = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.origin !== 'city_class') continue;
            if (!a.intimacy?.consummated) continue;
            if (a.spouse === 'husband') continue;
            a.intimacy.consummated = false;
            a.intimacy.level = 0;
            a.intimacy.lastAt = 0;
            cleared.push(a.name);
          }
          world.flags = world.flags || {};
          world.flags.classIntimacyFixV1 = { at: Date.now(), cleared };
          if (cleared.length) console.log(`[Intimacy] 清理阶级误标：${cleared.join('、')}`);
        }
      } catch { /* 忽略 */ }

"""
if 'classIntimacyFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('③ 清理误标')
