import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 全被剔空 → 交给在场者/兜底，不留空、也不留不在场的人
old = """      const merged = kept.join('').trim();
      if (merged) reply = merged;"""
new = """      const merged = kept.join('').trim();
      if (merged) {
        reply = merged;
      } else {
        // 全被剔掉（他这句里只有一个不在场的人）：改成在场者的旁观叙述，绝不让人隔空开腔
        const presentOne = Object.values(wPres.actors || {}).find(
          (a) => a && !a.dead && a.id !== mePres?.id && a.location === hereLoc && a.name,
        );
        reply = presentOne
          ? `【${presentOne.name}】：（${presentOne.name}听你提起这个名字，顿了顿）他此刻人不在跟前。`
          : '（你问的人此刻不在跟前，四下无人接话。）';
        console.log('[Presence] 该句只剩不在场者，已改为在场叙述');
      }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 剔空后兜底')

# ② 提示词：点名不在场时，明确禁止替他说话
old2 = """        console.log(`[Scene] 点名不在场：${absent.name}@${whereA}（交给天道措辞）`);"""
new2 = """        contextHint += `（【铁律】${absent.name}此刻在「${whereA}」，**绝不可写【${absent.name}】的台词**；只能由在场的人回答，或写成旁白。）\\n`;
        console.log(`[Scene] 点名不在场：${absent.name}@${whereA}（已禁止替他开口）`);"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 提示词禁止替他开口')
io.open(p, 'w', encoding='utf-8-sig').write(s)
