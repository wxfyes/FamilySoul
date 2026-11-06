import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：娶进来的小姐/才女，名分改成侧室"
add = """      // 一次性：侧室住东厢、别在街上晃；仪式状态归端庄
      try {
        if (!world.flags?.sideRoomFixV1) {
          const eastRoom = Object.keys(world.places || {}).find((id) => /mansion_east/.test(id));
          const fixed = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (String(a.spouse || '') !== 'husband') continue;
            if (!/侧室|如夫人|二房|妾|姨娘|通房/.test(String(a.role || ''))) continue;
            if (eastRoom) { a.home = eastRoom; a.location = eastRoom; }
            if (a.intimacy) { a.intimacy.ritual = 'solemn'; a.intimacy.tone = 0; }
            fixed.push(a.name);
          }
          world.flags = world.flags || {};
          world.flags.sideRoomFixV1 = { at: Date.now(), fixed };
          if (fixed.length) console.log(`[Rank] 侧室归东厢：${fixed.join('、')}`);
        }
      } catch { /* 忽略 */ }

"""
if 'sideRoomFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('侧室归东厢')
