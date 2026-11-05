import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 此间陈设与可做之事：只给事实，怎么接戏由天道决定"
add = """    // 府中兵事与存粮：家眷与管家自然知道家里有多少兵、多少粮（不必相公逐条交代）
    try {
      const wMil2 = loadState(this.dataDir);
      const fj = (wMil2.factions || {}).wangjia;
      if (fj) {
        const kinds = fj.kinds || {};
        const total = Number(fj.troops) || 0;
        contextHintEarly += `（【府中兵事】家丁 ${Number(kinds.guard) || 0} 人、护院 ${Number(kinds.retainer) || 0} 人、营兵 ${Number(kinds.army) || 0} 人（共 ${total} 人）；`
          + `月饷 ${(Number(fj.monthlyPay) || 0).toFixed(1)} 两；府库存粮 ${(Number(fj.grain) || 0).toFixed(1)} 石。`
          + `家里管事的人（正妻、管家）自然知道这些数目，问起就照实说；但别主动炫耀兵力。）\\n`;
      }
    } catch { /* 忽略 */ }

""" + anchor
if '【府中兵事】' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 注入府中兵事事实')
