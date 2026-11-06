import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { proposeMarriage, isMarriageable, acceptAlliance, declineAlliance } from './world/marriage.js';",
              "import { proposeMarriage, isMarriageable, acceptAlliance, declineAlliance } from './world/marriage.js';\nimport { buyRice, sellRice, gamble, bribeOfficials, ensureDen, stockOf, ricePrice } from './world/goods.js';", 1)
anchor = "    // 8.786 旧报价作废"
add = """    // 8.7855 货与赌：买米/卖米/赌一把/打点官府
    try {
      const sayG = String(sayText || '');
      const wG = loadState(this.dataDir);
      const meG = wG.actors?.[this._viewerActorId || 'husband'] || wG.actors?.husband;
      const cityG = (() => { const seg = String(wG.places?.[meG?.location]?.name || '').split('·')[0]; return /府$|州$|县$/.test(seg) ? seg : '临江府'; })();

      let mG = /买\\s*(\\d+)\\s*([斗石])米?/.exec(sayG) || /买米\\s*(\\d+)/.exec(sayG);
      if (mG) {
        const qty = Number(mG[1]) * (mG[2] === '石' ? 10 : 1);
        const r = buyRice(wG, meG.id, qty);
        saveState(this.dataDir, wG);
        reply += `\\n${r.line}`;
      }
      if (/卖\\s*(米)?|出\\s*米/.test(sayG) && stockOf(wG, meG.id) > 0) {
        const mSell = /卖\\s*(\\d+)/.exec(sayG);
        const r = sellRice(wG, meG.id, mSell ? Number(mSell[1]) : stockOf(wG, meG.id));
        saveState(this.dataDir, wG);
        reply += `\\n${r.line}`;
      }
      const mGamble = /赌\\s*(一把)?\\s*([\\d.]+)\\s*两|押\\s*([\\d.]+)\\s*两/.exec(sayG);
      if (mGamble) {
        ensureDen(wG, cityG);
        const stake = Number(mGamble[2] || mGamble[3]);
        const r = gamble(wG, meG.id, stake);
        saveState(this.dataDir, wG);
        reply += `\\n${r.line}`;
      }
      if (/打点(官府|衙门)/.test(sayG)) {
        const mB = /([\\d.]+)\\s*两/.exec(sayG);
        const r = bribeOfficials(wG, meG.id, mB ? Number(mB[1]) : 10);
        saveState(this.dataDir, wG);
        reply += `\\n${r.line}`;
      }
    } catch (err) { console.warn('[Goods] 处理失败：', err.message); }

""" + anchor
if '买米/卖米/赌一把' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加货与赌指令')

# 日结：查赌
p2 = 'src/world/tick.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'dailyGambleRaid' not in t:
    t = t.replace("import { refreshTitles } from './occupation.js';",
                  "import { refreshTitles } from './occupation.js';\nimport { dailyGambleRaid } from './goods.js';", 1)
    t = t.replace("  // ── ③.7 差事工钱", "  try { dailyGambleRaid(world); } catch { /* 忽略 */ }\n\n  // ── ③.7 差事工钱", 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('日结查赌')
