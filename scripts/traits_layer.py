import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 差事：天道把\"谁去办什么\"记成差事，后面办到哪一步都能追"
block = """    // 习性：相处久了性情会变，变了要记住（[[trait:谁|哪一样|+-数]]）
    try {
      const traitTags = String(reply || '').match(/\\[\\[trait:([^\\]]+)\\]\\]/g);
      if (traitTags && traitTags.length) {
        const wTr = loadState(this.dataDir);
        for (const tag of traitTags) {
          const m = /\\[\\[trait:(.+?)\\|([^|]+)\\|([+-]?\\d+)\\]\\]/.exec(tag);
          if (!m) continue;
          const whoName = String(m[1]).trim();
          const key = String(m[2]).trim().slice(0, 8);
          const delta = Math.max(-20, Math.min(20, Number(m[3]) || 0));
          const who = Object.values(wTr.actors || {}).find((a) => a && a.name === whoName);
          if (!who || !delta) continue;
          who.traits = who.traits || {};
          who.traits[key] = Math.max(0, Math.min(100, Number(who.traits[key] || 50) + delta));
          wTr.notes = Array.isArray(wTr.notes) ? wTr.notes : [];
          wTr.notes.push({ day: wTr.clock?.day, hour: wTr.clock?.hour, text: `${who.name}的${key}${delta > 0 ? '增' : '减'}了` });
          console.log(`[Trait] ${who.name} ${key} ${delta > 0 ? '+' : ''}${delta} → ${who.traits[key]}`);
        }
        wTr.notes = (wTr.notes || []).slice(-40);
        saveState(this.dataDir, wTr);
        reply = String(reply || '').replace(/\\[\\[trait:[^\\]]+\\]\\]/g, '').trim();
      }
    } catch { /* 忽略 */ }

    // 差事：天道把\"谁去办什么\"记成差事，后面办到哪一步都能追"""
if anchor in s and '[[trait:' not in s:
    s = s.replace(anchor, block, 1)
    print('① 加习性记录')

# 提示词：告诉它这回事
old = "      contextHintEarly += '（【差事规矩】"
new = """      contextHintEarly += '（【习性规矩】长期相处真的改了某个人的性子（更顺从、更敢顶嘴、开始怕你…），你可以在回复末尾附 [[trait:谁|哪一样|+5]]，一次最多动 5~10，别乱给。这东西会跟着她一辈子。）\\n';
      contextHintEarly += '（【差事规矩】"""
if old in s and '【习性规矩】' not in s:
    s = s.replace(old, new, 1)
    print('② 习性提示')

# 把在场者的习性注入提示，让它演得一致
old2 = "    // 将 Gate 门禁客观事实注入为天道推演的刚性阻力边界"
new2 = """    // 在场者的习性：同一句话，不同性子的人反应不一样
    try {
      const wT2 = loadState(this.dataDir);
      const meT2 = this._viewerActorId ? wT2.actors?.[this._viewerActorId] : wT2.actors?.husband;
      const near = Object.values(wT2.actors || {}).filter((a) => a && !a.dead && a.location === meT2?.location && a.id !== (meT2?.id || 'husband'));
      const lines2 = near
        .filter((a) => a.traits && Object.keys(a.traits).length)
        .slice(0, 4)
        .map((a) => `${a.name}：${Object.entries(a.traits).map(([k, v]) => `${k}${v}`).join('、')}`);
      if (lines2.length) contextHintEarly += `（【习性】${lines2.join('；')}。这些是处出来的，照它演。）\\n`;
    } catch { /* 忽略 */ }

    // 将 Gate 门禁客观事实注入为天道推演的刚性阻力边界"""
if old2 in s and '【习性】' not in s:
    s = s.replace(old2, new2, 1)
    print('③ 注入在场者习性')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
