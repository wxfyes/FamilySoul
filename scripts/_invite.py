import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { evictOutsiders } from './world/privacy.js';",
              "import { evictOutsiders, giveInvite, homeOf } from './world/privacy.js';", 1)
anchor = "    // 8.8 相公说\"清人/都出去/外人出去\""
add = """    // 8.7 相公说"请进/叫她进来"：门口的人这才算被叫进来（当日请帖）
    try {
      if (/请进|进来吧|叫她进来|叫他进来|让她进来|让他进来|领进来|带进来/.test(String(sayText || ''))) {
        const wI = loadState(this.dataDir);
        const meI = wI.actors?.[this._viewerActorId || 'husband'] || wI.actors?.husband;
        const myPlace = wI.places?.[meI?.location];
        const home = myPlace ? (homeOf(wI, myPlace) || wI.places?.husband_room) : wI.places?.husband_room;
        if (home) {
          const gateId = home.rooms?.gate?.id;
          const guests = Object.values(wI.actors || {}).filter(
            (a) => a && !a.dead && a.id !== meI?.id && a.location === gateId,
          );
          if (guests.length) {
            const names = [];
            for (const g of guests.slice(0, 3)) {
              giveInvite(wI, g.id, home.id);
              if (meI?.location) moveActor(wI, g.id, meI.location, 'world', '主人请进');
              names.push(g.name);
            }
            saveState(this.dataDir, wI);
            reply = String(reply || '') + `\\n（门房让开，${names.join('、')} 被请了进来。）`;
            console.log(`[Gate] 相公请进：${names.join('、')}`);
          }
        }
      }
    } catch (err) { console.warn('[Gate] 请进失败：', err.message); }

""" + anchor
if '当日请帖' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 请进指令')
