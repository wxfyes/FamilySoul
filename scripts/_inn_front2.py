import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：临江的两家客栈并成一家"
add = """      // 一次性：客栈掌柜站到前店柜台（不在后头房间里）
      try {
        if (!world.flags?.innFrontV1) {
          let moved = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (!/客栈掌柜|跑堂|伙计/.test(String(a.role || ''))) continue;
            const pn = String(world.places?.[a.location]?.name || '');
            if (!/客栈/.test(pn) || /柜台/.test(pn)) continue;
            const front = Object.keys(world.places || {}).find((id) => String(world.places[id]?.name || '') === `${pn}·前店柜台`);
            if (front) { a.location = front; moved += 1; }
          }
          world.flags = world.flags || {};
          world.flags.innFrontV1 = { at: Date.now(), moved };
          if (moved) console.log(`[Inn] 掌柜上前柜台：${moved} 人`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'innFrontV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('前台迁移 ok')
