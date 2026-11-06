import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const cnB = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100 };
        const rawCap = mCap ? mCap[1] : '50';
        const cap = /^\\d+$/.test(rawCap) ? Number(rawCap) : rawCap.split('').reduce((acc, ch) => {
          if (cnB[ch]) return ch === '百' ? Math.max(100, acc) : acc + cnB[ch];
          return acc;
        }, 0);
        const r = startTradeRun(wBz, meBz.id, cap || 50);"""
new = """        const cnB = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
        const rawCap = mCap ? mCap[1] : '50';
        let cap;
        if (/^\\d+$/.test(rawCap)) cap = Number(rawCap);
        else {
          let total = 0; let cur = 0;
          for (const ch of rawCap) {
            if (cnB[ch] != null) cur = cnB[ch];
            else if (ch === '十') { total += (cur || 1) * 10; cur = 0; }
            else if (ch === '百') { total += (cur || 1) * 100; cur = 0; }
          }
          cap = total + cur;
        }
        const r = startTradeRun(wBz, meBz.id, cap || 50);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('五十两=50')
