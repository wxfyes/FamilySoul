import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { describeRoom, roomForHour } from './world/room-life.js';",
              "import { describeRoom, roomForHour } from './world/room-life.js';\nimport { knock, grantPass, residenceOf } from './world/visit.js';", 1)
anchor = "    // 身份前缀补完之后，再按在场铁律收一遍（防止后段把不在场的人加回来）"
add = """    // 站在人家门口说"通禀/求见/递帖/叫门"：真去叩门，门房给准话
    try {
      if (/通禀|通报|求见|递帖|递帖子|叫门|叩门|拜见|拜访|见你家|请见/.test(String(say || ''))) {
        const wV = loadState(this.dataDir);
        const meV = this._viewerActorId ? wV.actors?.[this._viewerActorId] : wV.actors?.husband;
        const hereV = wV.places?.[meV?.location];
        const isGate = /大门|门房|门厅|仪门|轿厅/.test(String(hereV?.name || '')) || hereV?.use === 'gate';
        if (isGate && hereV?.parent) {
          const home = residenceOf(wV, hereV.id) || wV.places?.[hereV.parent];
          if (home && String(home.owner || '') !== String(meV?.id || '')) {
            const v = knock(wV, meV.id, home.id);
            if (v.allowed && v.place) {
              grantPass(wV, meV.id, home.id, wV.clock?.day);
              moveActor(wV, meV.id, v.place, 'world', '通禀允入');
              saveState(this.dataDir, wV);
              reply = `（门房进去回了话，回身拱手：「${v.reason}」）\\n` + String(reply || '');
            } else {
              saveState(this.dataDir, wV);
              reply = `（门房拦住：「${v.reason}」）\\n` + String(reply || '');
            }
          }
        }
      }
    } catch { /* 忽略 */ }

""" + anchor
if '门房进去回了话' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 门口通禀会真去叩门')
