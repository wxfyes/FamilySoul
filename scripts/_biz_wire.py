import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { buyRice, addRice, sellRice, gamble, bribeOfficials, ensureDen, stockOf, ricePrice } from './world/goods.js';",
              "import { buyRice, addRice, sellRice, gamble, bribeOfficials, ensureDen, stockOf, ricePrice } from './world/goods.js';\nimport { startTradeRun, startNightMarket, drainBizNotices } from './world/business.js';", 1)
anchor = "    // 8.7855 货与赌"
add = """    // 8.7853 经营动作：走货 / 夜市（模型提，引擎扣钱与结算）
    try {
      const sayB = String(sayText || '');
      const wBz = loadState(this.dataDir);
      const meBz = wBz.actors?.[this._viewerActorId || 'husband'] || wBz.actors?.husband;
      const mRun = /(走货|押一船|进一批茶|发一船货)/.test(sayB);
      if (mRun) {
        const mCap = /([\\d一二两三四五六七八九十百]+)\\s*两/.exec(sayB);
        const cnB = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100 };
        const rawCap = mCap ? mCap[1] : '50';
        const cap = /^\\d+$/.test(rawCap) ? Number(rawCap) : rawCap.split('').reduce((acc, ch) => {
          if (cnB[ch]) return ch === '百' ? Math.max(100, acc) : acc + cnB[ch];
          return acc;
        }, 0);
        const r = startTradeRun(wBz, meBz.id, cap || 50);
        saveState(this.dataDir, wBz);
        reply += `\\n【提示】${String(r.line).replace(/^（|）$/g, '')}`;
      }
      if (/夜市|夜场|开夜/.test(sayB)) {
        const r2 = startNightMarket(wBz, meBz.id, 8);
        saveState(this.dataDir, wBz);
        reply += `\\n【提示】${String(r2.line).replace(/^（|）$/g, '')}`;
      }
      // 到期的船次/经营消息：顺手告诉他
      const notes = drainBizNotices(wBz);
      if (notes.length) {
        saveState(this.dataDir, wBz);
        for (const n of notes) reply += `\\n【提示】${n.text}`;
      }
    } catch (err) { console.warn('[Biz] 处理失败：', err.message); }

""" + anchor
if '8.7853 经营动作' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('经营指令')

# 日结：船回/夜市到期
p2 = 'src/world/tick.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'settleTradeRuns' not in t:
    t = t.replace("import { dailyGambleRaid } from './goods.js';",
                  "import { dailyGambleRaid } from './goods.js';\nimport { settleTradeRuns, settleNightMarket } from './business.js';", 1)
    t = t.replace("  try { dailyGambleRaid(world); } catch { /* 忽略 */ }",
                  "  try { dailyGambleRaid(world); } catch { /* 忽略 */ }\n  try { settleTradeRuns(world); } catch { /* 忽略 */ }\n  try { settleNightMarket(world); } catch { /* 忽略 */ }", 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('日结船次')
