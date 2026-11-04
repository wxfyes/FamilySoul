import io

# ============ 天道收尾：[[deal:片段|成]] / [[deal:片段|不成]] ============
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 告诉天道：要收钱就这么声明（由相公自己点确认）"
block = """    // 事情办完没有，由天道说了算：[[deal:片段|成]] 或 [[deal:片段|不成]]
    try {
      const dealTags = String(reply || '').match(/\\[\\[deal:([^\\]]+)\\]\\]/g);
      if (dealTags && dealTags.length) {
        const wDeal = loadState(this.dataDir);
        wDeal.notes = Array.isArray(wDeal.notes) ? wDeal.notes : [];
        for (const tag of dealTags) {
          const m = /\\[\\[deal:(.+?)\\|(成|不成)\\]\\]/.exec(tag);
          if (!m) continue;
          const frag = String(m[1]).trim();
          const ok = m[2] === '成';
          // 约定
          const apIdx = (wDeal.appointments || []).findIndex((x) => x && (String(x.text || '').includes(frag) || String(x.name || '') === frag));
          if (apIdx >= 0) {
            const ap = wDeal.appointments[apIdx];
            wDeal.appointments.splice(apIdx, 1);
            wDeal.notes.push({ day: wDeal.clock?.day, hour: wDeal.clock?.hour, text: `与${ap.name || '人'}的约${ok ? '已了' : '没成'}` });
            continue;
          }
          // 承诺
          for (const pr of (wDeal.promises || [])) {
            if (!pr || pr.done) continue;
            if (!String(pr.text || '').includes(frag)) continue;
            if (ok) { pr.done = true; pr.settledBy = 'dm'; }
            else { pr.settled = 'failed'; pr.settledBy = 'dm'; }
            wDeal.notes.push({ day: wDeal.clock?.day, hour: wDeal.clock?.hour, text: `旧诺「${String(pr.text || '').slice(0, 14)}」${ok ? '办成了' : '没办成'}` });
            break;
          }
        }
        wDeal.notes = wDeal.notes.slice(-40);
        saveState(this.dataDir, wDeal);
        reply = String(reply || '').replace(/\\[\\[deal:[^\\]]+\\]\\]/g, '').trim();
        console.log(`[Deal] 天道了结 ${dealTags.length} 桩事`);
      }
    } catch { /* 忽略 */ }

    // 告诉天道：要收钱就这么声明（由相公自己点确认）"""
if anchor in s and '[[deal:' not in s:
    s = s.replace(anchor, block, 1)
    print('① 加天道收尾标记')

# 提示词：告诉它可以这么收尾
old = "      contextHintEarly += '（【收钱规矩】"
new = """      contextHintEarly += '（【了结规矩】若一件约定或承诺在剧情里真的办完了/彻底黄了，你在回复末尾附 [[deal:片段|成]] 或 [[deal:片段|不成]]，片段取自那件事的原话。别自己宣布"这事就当没发生过"，要有个交代。）\\n';
      contextHintEarly += '（【收钱规矩】"""
if old in s and '【了结规矩】' not in s:
    s = s.replace(old, new, 1)
    print('② 加提示')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
