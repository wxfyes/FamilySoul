import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.7853 经营动作：走货 / 夜市"
add = """    // 8.7851 "就按你说的办"：把她上一轮提的经营主意落地
    try {
      const sayGo = String(sayText || '');
      if (/(按|照|依)(你|她|娘子|婉儿)的?(想法|意思|主意|话)|就按这个(来|办)|全凭你(安排|做主)/.test(sayGo)) {
        const fs = require('node:fs');
        const pathM = require('node:path');
        const key = this.memberKey || 'husband';
        const histFile = pathM.join(this.dataDir, 'chat', `history-${key}.json`);
        let last = '';
        try {
          const arr = JSON.parse(fs.readFileSync(histFile, 'utf8'));
          const assistant = (Array.isArray(arr) ? arr : []).filter((m) => m && (m.role === 'assistant' || m.speaker)).pop();
          last = String(assistant?.text || assistant?.content || '');
        } catch { last = ''; }
        if (last) {
          const wGo = loadState(this.dataDir);
          const meGo = wGo.actors?.[this._viewerActorId || 'husband'] || wGo.actors?.husband;
          const doneLines = [];
          if (/走货|押一船|进一批茶|船帮/.test(last)) {
            const r = startTradeRun(wGo, meGo.id, 50);
            if (r.ok) doneLines.push(r.line);
          }
          if (/夜市|夜场|抽头/.test(last)) {
            const r2 = startNightMarket(wGo, meGo.id, 8);
            if (r2.ok) doneLines.push(r2.line);
          }
          if (!doneLines.length && /雇|添人手|伙计/.test(last)) {
            const props = (wGo.assets?.properties || []).filter((x) => x);
            if (props.length) {
              props[0].staff = (Number(props[0].staff) || 0) + 1;
              doneLines.push(`（${props[0].name}添了一名伙计，人手多一分，日入也要多担一份工钱。）`);
            }
          }
          if (doneLines.length) {
            saveState(this.dataDir, wGo);
            for (const ln of doneLines) reply += `\\n【提示】${String(ln).replace(/^（|）$/g, '')}`;
          } else {
            reply += '\\n【提示】她说的主意里，没有一件是能当场落地的（要么没提具体营生，要么本钱不够）。';
          }
        }
      }
    } catch (err) { console.warn('[Biz] 按你说的办失败：', err.message); }

""" + anchor
if '8.7851' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('按你说的办')
