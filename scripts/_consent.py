import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 规矩改写：不开口才收敛；明令即放开
old = "contextHintEarly += '（【房里规矩】夜里不得主动求欢。正妻至多低声问一句\"今夜要不要妾身服侍\"；侧室、丫鬟一概不许主动提，须相公点名才可近身。谁今夜已经闹过，就记在她名下，两日内不许再提。）\\n';"
new = "contextHintEarly += '（【房里规矩】相公没开口时，妻妾不得主动求欢（正妻可低声问一句要不要服侍）。相公一旦明说\"服侍/侍寝/要你/开始/继续/宽衣\"，就是明令：不必暗号、不得推脱、不得打岔劝睡，该怎么做就怎么做，写到位；应了的妻妾今夜可放开服侍，天亮归位。）\\n';"
if old in s:
    s = s.replace(old, new, 1)
    print('① 规矩改写')

# ② 明令 → 引擎把在场的应承者标为今夜解禁
anchor = "    // 房事规矩（给天道的事实，不是台词）"
add = """    // 相公明令侍寝：引擎把在场妻妾标成"今夜解禁"，不必暗号
    try {
      if (/(服侍|侍寝|要你|陪我睡|开始|继续|上来|宽衣|脱了)/.test(String(say || ''))) {
        const wT = loadState(this.dataDir);
        const meT = wT.actors?.[this._viewerActorId || 'husband'] || wT.actors?.husband;
        const dayT = Number(wT.clock?.day) || 1;
        const marked = [];
        for (const a of Object.values(wT.actors || {})) {
          if (!a || a.dead || a.location !== meT?.location) continue;
          if (!/正妻|如夫人|二房|侧室|妾|通房/.test(String(a.role || ''))) continue;
          a.intimacy = a.intimacy || { level: 0, tone: 0, lastAt: 0, ritual: 'solemn' };
          a.intimacy.ritual = 'unlocked';
          a.intimacy.tone = 3;
          a.intimacy.consentedDay = dayT;
          a.intimacy.lastAt = dayT;
          marked.push(a.name);
        }
        if (marked.length) {
          saveState(this.dataDir, wT);
          contextHintEarly += `（【今夜已准】${marked.join('、')}已得相公明令，今夜解禁，可放开服侍，不必再问、不必再请示。）\\n`;
          console.log(`[Intimacy] 明令解禁：${marked.join('、')}`);
        }
      }
    } catch (err) { console.warn('[Intimacy] 解禁失败：', err.message); }

""" + anchor
if '今夜已准' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    print('② 明令解禁')
io.open(p, 'w', encoding='utf-8-sig').write(s)
