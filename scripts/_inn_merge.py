import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：每城客栈得有个掌柜"
add = """      // 一次性：临江的两家客栈并成一家（老"临江客栈"为准）
      try {
        if (!world.flags?.innMergeV1) {
          const legacyFront = Object.keys(world.places || {}).find((id) => world.places[id]?.name === '临江客栈·前店柜台');
          const dupIds = Object.keys(world.places || {}).filter((id) => /^临江_inn/.test(id));
          let moved = 0;
          for (const id of dupIds) {
            const pl = world.places[id];
            const isFront = /前店|柜台/.test(String(pl?.name || ''));
            const dest = isFront && legacyFront ? legacyFront : 'inn';
            for (const a of Object.values(world.actors || {})) {
              if (a && !a.dead && a.location === id) { a.location = dest; moved += 1; }
            }
            delete world.places[id];
          }
          if (world.flags?.cityBase?.['临江府']) world.flags.cityBase['临江府'].innId = 'inn';
          world.flags = world.flags || {};
          world.flags.innMergeV1 = { at: Date.now(), moved, removed: dupIds.length };
          if (dupIds.length) console.log(`[Inn] 合并临江客栈：清 ${dupIds.length} 处，迁 ${moved} 人`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'innMergeV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('客栈合并迁移')
