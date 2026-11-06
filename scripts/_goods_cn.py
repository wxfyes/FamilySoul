import io
p = 'src/world/goods.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function addRice' not in s:
    s = s.replace("/** 卖米：铺面/牙行抽三分，剩的进账 */",
"""/** 只记货、不再扣钱（钱已由付款入口扣过） */
export function addRice(world, whoId, dou) {
  const qty = Math.floor(num(dou));
  if (!(qty > 0)) return { ok: false, line: '' };
  bag(world, whoId).rice += qty;
  return { ok: true, line: `（吃进 ${qty} 斗米，已入仓。现存 ${bag(world, whoId).rice} 斗。）` };
}

/** 卖米：铺面/牙行抽三分，剩的进账 */""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('addRice')

@'
import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { buyRice, sellRice, gamble, bribeOfficials, ensureDen, stockOf, ricePrice } from './world/goods.js';",
              "import { buyRice, addRice, sellRice, gamble, bribeOfficials, ensureDen, stockOf, ricePrice } from './world/goods.js';", 1)
# 中文数字 + 付款已代扣时只记货
old = """      let mG = /买\\s*(\\d+)\\s*([斗石])米?/.exec(sayG) || /买米\\s*(\\d+)/.exec(sayG);
      if (mG) {
        const qty = Number(mG[1]) * (mG[2] === '石' ? 10 : 1);
        const r = buyRice(wG, meG.id, qty);
        saveState(this.dataDir, wG);
        reply += `\\n${r.line}`;
      }"""
new = """      const cnNum = (raw) => {
        const t = String(raw || '').trim();
        if (/^\\d+$/.test(t)) return Number(t);
        const d = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
        let total = 0; let cur = 0;
        for (const ch of t) {
          if (d[ch] != null) cur = d[ch];
          else if (ch === '十') { total += (cur || 1) * 10; cur = 0; }
          else if (ch === '百') { total += (cur || 1) * 100; cur = 0; }
          else if (ch === '千') { total += (cur || 1) * 1000; cur = 0; }
        }
        return total + cur;
      };
      let mG = /买\\s*([\\d一二两三四五六七八九十百千]+)\\s*([斗石])米?/.exec(sayG) || /买米\\s*([\\d一二两三四五六七八九十百千]+)/.exec(sayG);
      if (mG) {
        const qty = cnNum(mG[1]) * (mG[2] === '石' ? 10 : 1);
        const paidAlready = /已付/.test(String(reply || ''));
        const r = paidAlready ? addRice(wG, meG.id, qty) : buyRice(wG, meG.id, qty);
        saveState(this.dataDir, wG);
        reply += `\\n${r.line}`;
      }"""
if old in s:
    s = s.replace(old, new, 1)
    # 卖米和赌也支持中文数字
    s = s.replace("""        const mSell = /卖\\s*(\\d+)/.exec(sayG);
        const r = sellRice(wG, meG.id, mSell ? Number(mSell[1]) : stockOf(wG, meG.id));""",
"""        const mSell = /卖\\s*([\\d一二两三四五六七八九十百]+)/.exec(sayG);
        const r = sellRice(wG, meG.id, mSell ? cnNum(mSell[1]) : stockOf(wG, meG.id));""", 1)
    s = s.replace("""      const mGamble = /赌\\s*(一把)?\\s*([\\d.]+)\\s*两|押\\s*([\\d.]+)\\s*两/.exec(sayG);""",
"""      const mGamble = /赌\\s*(一把)?\\s*([\\d.一二两三四五六七八九十百]+)\\s*两|押\\s*([\\d.一二两三四五六七八九十百]+)\\s*两/.exec(sayG);""", 1)
    s = s.replace("        const stake = Number(mGamble[2] || mGamble[3]);", "        const stake = cnNum(mGamble[2] || mGamble[3]);", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('中文数字与已付判断')
