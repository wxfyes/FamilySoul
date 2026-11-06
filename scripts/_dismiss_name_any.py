import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.83 相公点名让谁去某处"
add = """    // 8.82 话里点到谁 + 让他走：不管有没有"让/叫"，只要点了名又说了走，就真让他走
    try {
      if (/回去|回家|回房|回屋|回铺子|走吧|退下|去吧|散了吧/.test(String(sayText || ''))) {
        const wN = loadState(this.dataDir);
        const meN = wN.actors?.[this._viewerActorId || 'husband'] || wN.actors?.husband;
        const named = Object.values(wN.actors || {}).filter((a) => a && !a.dead && a.name
          && String(sayText).includes(a.name) && a.id !== meN?.id && !String(a.id).startsWith('usr_'));
        for (const who of named.slice(0, 3)) {
          let dest = who.quarters || who.home;
          if (!dest || !wN.places?.[dest] || dest === who.location) dest = 'street';
          if (!wN.places?.[dest] || dest === who.location) continue;
          const mv = moveActor(wN, who.id, dest, 'world', '送客离场');
          if (mv?.ok) {
            saveState(this.dataDir, wN);
            reply = `（${who.name}应了一声，往${wN.places[dest].name}去了。）\\n` + String(reply || '');
            console.log(`[Departure] 点名走人：${who.name} → ${wN.places[dest].name}`);
          }
        }
      }
    } catch { /* 忽略 */ }

""" + anchor
if '点名走人' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 点名+走就搬')
