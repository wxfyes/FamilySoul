import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.9 相公明确说\"你走吧/退下/送客\""
add = """    // 8.85 相公说"进你屋里/去你房间"：对方答应了就真的换场（她带你进她的私房）
    try {
      if (/(去|进|到)\\s*你(的)?\\s*(屋|房间|房里|闺房|卧室|内室)|带我(去|进|上)|进你屋/.test(String(sayText || ''))) {
        const wR = loadState(this.dataDir);
        const meR = wR.actors?.[this._viewerActorId || 'husband'] || wR.actors?.husband;
        const hereR = wR.places?.[meR?.location];
        // 这一场里跟着的、不是本家的人（比如紫嫣）
        const guest = Object.values(wR.actors || {}).find((a) => a && !a.dead && a.id !== meR?.id
          && a.location === meR?.location && !a.household && !String(a.id).startsWith('usr_'));
        if (guest) {
          // 她的私房：优先她自己住处；否则这处场子的"上房/雅间/后宅"那类房
          let target = null;
          const home = guest.home && wR.places?.[guest.home];
          if (home && (home.residence || home.rooms)) {
            const key = home.rooms && (home.rooms.wing ? 'wing' : (home.rooms.main ? 'main' : (home.rooms.back ? 'back' : null)));
            target = key ? home.rooms[key]?.id : home.id;
          }
          if (!target && hereR?.parent) {
            const par = wR.places?.[hereR.parent];
            const key2 = par?.rooms && ['back', 'room', 'main', 'f3', 'f2'].find((k) => par.rooms[k]);
            target = key2 ? par.rooms[key2].id : null;
          }
          if (target && wR.places?.[target]) {
            moveActor(wR, guest.id, target, 'world', '带相公入内室');
            if (meR?.id) moveActor(wR, meR.id, target, 'world', '随她入内室');
            try { guest.invitedTo = { home: hereR?.parent || target, day: wR.clock?.day || 1 }; } catch { /* 忽略 */ }
            saveState(this.dataDir, wR);
            reply = `（${guest.name}引着相公往里走，帘子一挑，进了内室。）\\n` + String(reply || '');
            console.log(`[Scene] ${guest.name} 带相公进了 ${wR.places?.[target]?.name || target}`);
          }
        }
      }
    } catch (err) { console.warn('[Scene] 入内室失败：', err.message); }

""" + anchor
if '带相公入内室' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 答应进房就换场')
