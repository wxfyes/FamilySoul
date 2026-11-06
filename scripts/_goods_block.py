import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find("    // 8.7855 货与赌")
end = s.find("    // 8.786 旧报价作废", start)
assert start > 0 and end > start, (start, end)
block = '''    // 8.7855 货与赌：买米/卖米/赌一把/打点官府（中文数字也认）
    try {
      const sayG = String(sayText || '');
      const wG = loadState(this.dataDir);
      const meG = wG.actors?.[this._viewerActorId || 'husband'] || wG.actors?.husband;
      const cityG = (() => { const seg = String(wG.places?.[meG?.location]?.name || '').split('\\u00b7')[0]; return /\\u5e9c$|\\u5dde$|\\u53bf$/.test(seg) ? seg : '\\u4e34\\u6c5f\\u5e9c'; })();
      const cnNumOf = (raw) => {
        const t = String(raw || '').trim();
        if (/^\\d+(\\.\\d+)?$/.test(t)) return Number(t);
        const d = { \\u96f6: 0, \\u4e00: 1, \\u4e8c: 2, \\u4e24: 2, \\u4e09: 3, \\u56db: 4, \\u4e94: 5, \\u516d: 6, \\u4e03: 7, \\u516b: 8, \\u4e5d: 9 };
        let total = 0; let cur = 0;
        for (const ch of t) {
          if (d[ch] != null) cur = d[ch];
          else if (ch === '\\u5341') { total += (cur || 1) * 10; cur = 0; }
          else if (ch === '\\u767e') { total += (cur || 1) * 100; cur = 0; }
          else if (ch === '\\u5343') { total += (cur || 1) * 1000; cur = 0; }
        }
        return total + cur;
      };
      const mBuy = /\\u4e70\\s*([\\d\\u4e00\\u4e24\\u4e09\\u56db\\u4e94\\u516d\\u4e03\\u516b\\u4e5d\\u5341\\u767e\\u5343]+)\\s*([\\u6597\\u77f3])/.exec(sayG);
      if (mBuy) {
        const qty = cnNumOf(mBuy[1]) * (mBuy[2] === '\\u77f3' ? 10 : 1);
        const paidAlready = /\\u5df2\\u4ed8/.test(String(reply || ''));
        const r = paidAlready ? addRice(wG, meG.id, qty) : buyRice(wG, meG.id, qty);
        saveState(this.dataDir, wG);
        reply += `\\n${r.line}`;
      }
      const mSell = /\\u5356\\s*([\\d\\u4e00\\u4e24\\u4e09\\u56db\\u4e94\\u516d\\u4e03\\u516b\\u4e5d\\u5341\\u767e]+)/.exec(sayG);
      if (mSell && stockOf(wG, meG.id) > 0) {
        const r = sellRice(wG, meG.id, cnNumOf(mSell[1]));
        saveState(this.dataDir, wG);
        reply += `\\n${r.line}`;
      }
      const mGamble = /\\u8d4c\\s*(\\u4e00\\u628a)?\\s*([\\d\\u4e00\\u4e24\\u4e09\\u56db\\u4e94\\u516d\\u4e03\\u516b\\u4e5d\\u5341\\u767e.]+)\\s*\\u4e24/.exec(sayG);
      if (mGamble) {
        ensureDen(wG, cityG);
        const r = gamble(wG, meG.id, cnNumOf(mGamble[2]));
        saveState(this.dataDir, wG);
        reply += `\\n${r.line}`;
      }
      if (/\\u6253\\u70b9(\\u5b98\\u5e9c|\\u8862\\u95e8)/.test(sayG)) {
        const mB = /([\\d\\u4e00\\u4e24\\u4e09\\u56db\\u4e94\\u516d\\u4e03\\u516b\\u4e5d\\u5341]+)\\s*\\u4e24/.exec(sayG);
        const r = bribeOfficials(wG, meG.id, mB ? cnNumOf(mB[1]) : 10);
        saveState(this.dataDir, wG);
        reply += `\\n${r.line}`;
      }
    } catch (err) { console.warn('[Goods] \\u5904\\u7406\\u5931\\u8d25\\uff1a', err.message); }

'''
s = s[:start] + block + s[end:]
s = s.replace("import { buyRice, sellRice, gamble, bribeOfficials, ensureDen, stockOf, ricePrice } from './world/goods.js';",
              "import { buyRice, addRice, sellRice, gamble, bribeOfficials, ensureDen, stockOf, ricePrice } from './world/goods.js';", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('goods block rewritten')
