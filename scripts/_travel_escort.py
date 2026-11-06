import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        return sendJson(res, 200, { ok: true, applied: Boolean(res2.applied), place: placeName2, line });"""
new = """        // 随行的护院/家丁跟着主人走
        try {
          const wEsc = loadState(DATA_DIR);
          const meEsc = wEsc.actors?.[actorId];
          if (meEsc?.location) {
            let moved = 0;
            for (const g of Object.values(wEsc.actors || {})) {
              if (!g || g.dead || g.following !== actorId) continue;
              const mv = moveActor(wEsc, g.id, meEsc.location, 'world', '随主出行');
              if (mv?.ok) moved += 1;
            }
            if (moved) saveState(DATA_DIR, wEsc);
          }
        } catch { /* 忽略 */ }
        return sendJson(res, 200, { ok: true, applied: Boolean(res2.applied), place: placeName2, line });"""
if old in s and '随行的护院/家丁跟着主人走' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('出行带随从')
