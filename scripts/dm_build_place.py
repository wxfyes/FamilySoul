import io

# ============ 天道申报立新地方：[[build:地名|父地点]] ============
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 没地点的约定：让天道从\"世上现有的地方\"里指派一个，不许乱起名"
block = """    // 天道要造物：[[build:地名|父地点名]]（父地点可省，默认他现在所在）
    try {
      const buildTags = String(reply || '').match(/\\[\\[build:([^\\]]+)\\]\\]/g);
      if (buildTags && buildTags.length) {
        const wB = loadState(this.dataDir);
        const meB = this._viewerActorId ? wB.actors?.[this._viewerActorId] : wB.actors?.husband;
        const builtToday = Number(wB.flags?.buildDay || 0);
        let builtCount = builtToday === (wB.clock?.day || 1) ? (Number(wB.flags?.buildCount) || 0) : 0;
        for (const tag of buildTags) {
          if (builtCount >= 5) { console.log('[Build] 今日造物已达上限，驳回'); continue; }
          const m = /\\[\\[build:(.+?)(?:\\|([^\\]]+))?\\]\\]/.exec(tag);
          if (!m) continue;
          const rawName = String(m[1] || '').replace(/\\s/g, '');
          const parentName = String(m[2] || '').trim();
          // 验名：2~6 个汉字，不许疑问/指示/动词
          const valid = /^[\\u4e00-\\u9fa5]{2,6}$/.test(rawName)
            && !/(什么|哪|这里|那里|某|一个|怎么|如何|是否|到底)/.test(rawName)
            && !/(去|来|走|到|找|说|看)/.test(rawName);
          if (!valid) { console.log(`[Build] 名字「${rawName}」不像地名，驳回`); continue; }
          if (Object.values(wB.places || {}).some((pl) => pl && pl.name === rawName)) {
            console.log(`[Build] 「${rawName}」已经有了`);
            continue;
          }
          // 验出处：父地点必须存在；没给就挂在他此刻所在
          let parentId = null;
          if (parentName) {
            const hit = Object.entries(wB.places || {}).find(([, pl]) => pl && pl.name === parentName);
            if (!hit) { console.log(`[Build] 出处「${parentName}」不存在，驳回`); continue; }
            parentId = hit[0];
          } else {
            parentId = meB?.location || 'street';
          }
          wB.flags = wB.flags || {};
          wB.flags.placeSeq = (Number(wB.flags.placeSeq) || 0) + 1;
          const id = `place_${wB.flags.placeSeq}`;
          const pl = {
            id, name: rawName, exits: [parentId], dynamic: true,
            builtBy: 'dm', createdDay: wB.clock?.day || 1,
            desc: `天道在世设的一处：${rawName}`,
          };
          wB.places[id] = pl;
          wB.dynamicPlaces = wB.dynamicPlaces || {};
          wB.dynamicPlaces[id] = pl;
          wB.notes = Array.isArray(wB.notes) ? wB.notes : [];
          wB.notes.push({ day: wB.clock?.day, hour: wB.clock?.hour, text: `世上新添一处「${rawName}」` });
          builtCount += 1;
          wB.flags.buildDay = wB.clock?.day || 1;
          wB.flags.buildCount = builtCount;
          console.log(`[Build] 天道立了新地方：${rawName}（挂在${wB.places[parentId]?.name || parentId}）`);
        }
        wB.notes = (wB.notes || []).slice(-40);
        saveState(this.dataDir, wB);
        reply = String(reply || '').replace(/\\[\\[build:[^\\]]+\\]\\]/g, '').trim();
      }
    } catch { /* 忽略 */ }

    // 没地点的约定：让天道从\"世上现有的地方\"里指派一个，不许乱起名"""
if anchor in s and '[[build:' not in s:
    s = s.replace(anchor, block, 1)
    print('① 加造物申报')

# 提示词：告诉它有这道门
old = "      contextHintEarly += '（【了结规矩】"
new = """      contextHintEarly += '（【造物规矩】剧情确实需要一个世上没有的去处时，你可以在回复末尾附 [[build:地名|挂在哪处之下]]，例 [[build:听雨轩|临江茶坊]]。名字要像地名（2~6字，别用"那里/某处"这种）。每天最多立五处。）\\n';
      contextHintEarly += '（【了结规矩】"""
if old in s and '【造物规矩】' not in s:
    s = s.replace(old, new, 1)
    print('② 告诉天道有这道门')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
