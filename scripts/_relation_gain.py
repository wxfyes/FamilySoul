import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.79 说亲：话里点名"
add = """    // 8.78 相处涨交情：这轮与谁说了话、送了礼，就对谁涨信任（每城通用）
    try {
      const wR = loadState(this.dataDir);
      const meR0 = wR.actors?.[this._viewerActorId || 'husband'] || wR.actors?.husband;
      const speakers = [...String(reply || '').matchAll(/【([^】]{1,12})】/g)].map((m) => m[1]);
      const touched = new Set();
      for (const spk of speakers) {
        const nm = spk.includes('·') ? spk.split('·').pop().trim() : spk;
        if (!nm || nm === '旁白' || nm === meR0?.name) continue;
        const a = Object.values(wR.actors || {}).find((x) => x && !x.dead && x.name === nm && x.location === meR0?.location);
        if (!a) continue;
        touched.add(a.id);
      }
      // 点名的礼：给/赏/送 某人 X两
      const gifts = [];
      const mg = /(?:给|赏|送)[^。]{0,6}?([\\u4e00-\\u9fa5]{2,4})[^。]{0,4}?([一二三四五六七八九十两\\d]+)\\s*两/.exec(String(sayText || ''));
      const cnNum = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
      if (mg) {
        const who = Object.values(wR.actors || {}).find((x) => x && !x.dead && x.name === mg[1]);
        const rawN = mg[2].replace(/两/g, '');
        const amt = /^\\d+$/.test(rawN) ? Number(rawN) : (cnNum[rawN] || 1);
        if (who && amt > 0) gifts.push({ who, amt });
      }
      let changed = false;
      for (const id of touched) {
        const a = wR.actors[id];
        const rel = (a.relations = a.relations || {});
        const mine = (rel[meR0.id] = rel[meR0.id] || {});
        const today = Number(wR.clock?.day) || 1;
        if (Number(a.lastTalkDay) !== today) { a.lastTalkDay = today; a.talkToday = 0; }
        if (Number(a.talkToday || 0) >= 5) continue;
        mine.trust = Math.min(100, Math.round(((Number(mine.trust) || 0) + 1) * 10) / 10);
        a.talkToday = Number(a.talkToday || 0) + 1;
        changed = true;
      }
      for (const g of gifts) {
        const purse = meR0.id === 'husband' ? Number(wR.assets.silver) || 0 : Number(meR0.money) || 0;
        const amt = Math.min(g.amt, purse);
        if (amt <= 0) continue;
        if (meR0.id === 'husband') wR.assets.silver = Math.round((purse - amt) * 100) / 100;
        else meR0.money = Math.round((purse - amt) * 100) / 100;
        const rel = (g.who.relations = g.who.relations || {});
        const mine = (rel[meR0.id] = rel[meR0.id] || {});
        mine.trust = Math.min(100, Math.round(((Number(mine.trust) || 0) + Math.min(12, amt * 3)) * 10) / 10);
        changed = true;
        reply += `\\n（${g.who.name}收下了 ${amt.toFixed(2)} 两。）`;
      }
      if (changed) {
        saveState(this.dataDir, wR);
        if (touched.size) console.log(`[Relation] 这轮与 ${[...touched].map((id) => wR.actors[id]?.name).join('、')} 相处，交情略增`);
      }
    } catch (err) { console.warn('[Relation] 涨交情失败：', err.message); }

""" + anchor
if '相处涨交情' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加相处涨交情')
