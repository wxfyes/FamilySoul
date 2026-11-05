import io
# 天道要看得到朝廷的账：注入"朝廷近况"事实（只给数字与状态，不给剧情）
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 在场者的底细：他有没有成婚、住哪、在哪当差——谁问都得对得上"
block = """    // 朝廷近况：国库多少、够不够发俸、民心如何——天道讲朝堂戏时必须有账可依
    try {
      const wC = loadState(this.dataDir);
      const tr = wC.court?.treasury || {};
      const offices = Object.values(wC.court?.offices || {}).filter((o) => o && o.holder && !o.vacant).length;
      const cityList = Object.values(wC.cities || {});
      const unrestAvg = cityList.length ? Math.round(cityList.reduce((x, c) => x + (Number(c.unrest) || 0), 0) / cityList.length) : 0;
      const sil = Number(tr.silver) || 0;
      const inc = Number(tr.lastIncome) || 0;
      const exp = Number(tr.lastExpense) || 0;
      const status = sil <= 0 ? '国库已空' : (sil < 300 ? '国库拮据、官俸发不出' : '国库尚可');
      const bits = [
        `国库 ${sil.toFixed(1)} 两（昨日收 ${inc.toFixed(1)}、支 ${exp.toFixed(1)}，${status}）`,
        `在任官 ${offices} 人，各城平均民心 ${unrestAvg}`,
      ];
      if (Number(wC.flags?.courtPressure)) bits.push(`朝廷压力 ${Number(wC.flags.courtPressure)}`);
      if (Number(wC.flags?.courtBankrupt)) bits.push(`国库告罄 ${Number(wC.flags.courtBankrupt)} 次`);
      contextHintEarly += `（【朝廷近况】${bits.join('；')}。这是账上真数，朝堂戏只能照这个演，不许自己编富庶或盛世。）\\n`;
    } catch { /* 忽略 */ }

""" + anchor
if '【朝廷近况】' not in s:
    s = s.replace(anchor, block, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 注入朝廷近况')
