import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const isRealOther = Object.values(wOut.actors || {}).some(
            (a) => a && !a.dead && a.name === spk && a.id !== meId && /^usr_/.test(String(a.id)),
          );
          if (isRealOther) { console.log(`[Presence:出口] 剔除非本人操控的真人发言：${spk}`); continue; }"""
new = """        // 服务端出口铁律：只在当前地点的人能开口（本人除外）
          const baseName = spk.includes('·') ? spk.split('·').pop().trim() : spk;
          const meNow = wOut.actors?.[meId];
          const who = Object.values(wOut.actors || {}).find((a) => a && !a.dead && a.name === baseName);
          if (who && who.id !== meId && who.location !== meNow?.location) {
            console.log(`[Presence:出口] 剔除非在场发言：${spk}`);
            continue;
          }
          const isRealOther = Object.values(wOut.actors || {}).some(
            (a) => a && !a.dead && a.name === baseName && a.id !== meId && /^usr_/.test(String(a.id)),
          );
          if (isRealOther) { console.log(`[Presence:出口] 剔除非本人操控的真人发言：${spk}`); continue; }"""
if old in s and 'Presence:出口] 剔除非在场发言' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 出口按在场过滤')
