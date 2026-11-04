import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 8. 待付款声明：[[pay:标题|选项=价|选项=价]] 挂待付款，正文剥离"
block = """    // 7.9 天道嘴上谈定了价却没打标记：从它自己说的话里取这笔账
    //     （只读天道的话，不读相公的输入；谈定了就直接挂成待付，等你点头）
    try {
      if (!loadState(this.dataDir).pendingAction) {
        const cn = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
        const toNum = (t) => {
          if (/^\\d+$/.test(t)) return Number(t);
          let n = 0; let cur = 0;
          for (const ch of t) {
            if (ch === '十') { cur = cur === 0 ? 1 : cur; n += cur * 10; cur = 0; }
            else if (ch === '百') { n += (cur || 1) * 100; cur = 0; }
            else if (cn[ch]) cur = cn[ch];
          }
          return n + cur;
        };
        const m = String(reply || '').match(/([0-9]{1,5}|[一二两三四五六七八九十百]{1,5})\\s*两[\\s，。、]?[^。]{0,8}(?:成交|定下|说定|共|一共|付|给|价|银)/);
        if (m) {
          const amount = toNum(m[1]);
          if (amount > 0 && amount <= 5000) {
            const wP = loadState(this.dataDir);
            wP.pendingAction = {
              kind: 'spend',
              id: `pend_${Date.now()}`,
              title: String(reply || '').replace(/\\s/g, '').slice(0, 12) || '花销',
              options: [{ key: 'pay', label: '照付', price: amount }],
              by: this._viewerActorId || 'husband',
              askedDay: wP.clock?.day || 1,
              askedHour: wP.clock?.hour || 0,
            };
            saveState(this.dataDir, wP);
            console.log(`[Pay] 从天道话里取到价钱：${amount} 两`);
          }
        }
      }
    } catch { /* 忽略 */ }

""" + anchor
if '从天道话里取到价钱' not in s:
    s = s.replace(anchor, block, 1)
    print('加了"从天道话里取价"')
io.open(p, 'w', encoding='utf-8-sig').write(s)
