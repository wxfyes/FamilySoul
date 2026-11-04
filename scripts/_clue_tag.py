import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 雇人：天道替产业点人（唯一入口 hireStaff）"
block = """    // 线索：天道把打探到的底细落进世界（唯一入口：这里）
    try {
      const clueTags = String(reply || '').match(/\\[\\[clue:([^\\]]+)\\]\\]/g);
      if (clueTags && clueTags.length) {
        const wC = loadState(this.dataDir);
        wC.clues = Array.isArray(wC.clues) ? wC.clues : [];
        for (const tag of clueTags) {
          const m = /\\[\\[clue:([^|\\]]+)(?:\\|([^\\]]+))?\\]\\]/.exec(tag);
          if (!m) continue;
          const text = String(m[1] || '').trim().slice(0, 80);
          if (!text) continue;
          if (wC.clues.some((c) => String(c?.text || '') === text)) continue;
          wC.clues.push({
            text,
            day: wC.clock?.day || 1,
            source: String(m[2] || '打探').slice(0, 20),
            owner: this._viewerActorId || 'husband',
          });
          console.log(`[Clue] 记下：${text.slice(0, 20)}（${String(m[2] || '打探')}）`);
        }
        wC.clues = wC.clues.slice(-120);
        saveState(this.dataDir, wC);
        reply = String(reply || '').replace(/\\[\\[clue:[^\\]]+\\]\\]/g, '').trim();
      }
    } catch { /* 忽略 */ }

""" + anchor
if '[[clue:' not in s:
    s = s.replace(anchor, block, 1)
    print('① 加线索通道')

# 提示词：告诉天道怎么用
old = "      contextHintEarly += '（【差事规矩】"
new = """      contextHintEarly += '（【打探规矩】相公若差人去打听一个人的底细，或某处生意的实情，你把这桩事记成差事；等有了结果，用 [[clue:一句话底细|谁打探的]] 落进世界。打探可能只得到传言、也可能打草惊蛇，别一次给全。）\\n';
      contextHintEarly += '（【差事规矩】"""
if old in s and '【打探规矩】' not in s:
    s = s.replace(old, new, 1)
    print('② 加打探规矩提示')
io.open(p, 'w', encoding='utf-8-sig').write(s)
