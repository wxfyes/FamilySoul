import os

with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = """    // 诊脉：问到怀孕/喜脉，就把账本上的身子实情摆出来
    try {
      if (/(诊脉|把脉|怀孕|有喜|喜脉|身子|身孕|怀上)/.test(String(say || ''))) {
        const wQ = loadState(this.dataDir);
        const meQ = this._viewerActorId ? wQ.actors?.[this._viewerActorId] : wQ.actors?.husband;
        const hereQ = Object.values(wQ.actors || {}).filter(
          (a) => a && !a.dead && a.id !== 'husband' && a.id !== this._viewerActorId
            && (a.location === meQ?.location || a.household),
        );
        const preg = hereQ.filter((a) => a.pregnancy && !a.pregnancy.born);
        const askedWho = hereQ.find((a) => {
          if (!a.name) return false;
          const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
          return String(say || '').includes(a.name) || String(say || '').includes(short);
        });
        if (askedWho && askedWho.pregnancy && !askedWho.pregnancy.born) {
          contextHint += `（【诊脉】${askedWho.name}确有身孕，已 ${askedWho.pregnancy.days} 天。这是账本事实，不许说没有。）\\n`;
        } else if (askedWho) {
          contextHint += `（【诊脉】${askedWho.name}没有身孕。这是账本事实，不许说有了。）\\n`;
        } else if (preg.length) {
          contextHint += `（【诊脉】府里有孕的：${preg.map((a) => `${a.name}（${a.pregnancy.days} 天）`).join('、')}。这是账本事实。）\\n`;
        } else {
          contextHint += '（【诊脉】府里眼下没有谁有身孕。这是账本事实，不许编一个有孕的。）\\n';
        }
      }
    } catch { /* 忽略 */ }"""

replacement = """    // 诊脉与身孕：把账本上的身子实情摆出来（发起人自己的身孕绝不可遗漏！）
    try {
      const wQ = loadState(this.dataDir);
      const meQ = this._viewerActorId ? wQ.actors?.[this._viewerActorId] : wQ.actors?.husband;
      // 1. 如果发起人本人有孕（如紫嫣怀了相公的孩子），这是至高事实，无论是否专门提问都要让对话者知晓
      if (meQ && meQ.pregnancy && !meQ.pregnancy.born) {
        const pDays = Number(meQ.pregnancy.days) || 0;
        contextHint += `（【天大喜讯·腹中骨肉】${meQ.name}（玩家本人）腹中已确确凿凿怀有相公王甯的亲生骨肉，有喜已有 ${pDays} 天！这是铁打的既定事实，在场相公王甯与众人均完全知晓，必须万分怜惜温柔，绝不许说没有/不知道！）\\n`;
      }
      if (/(诊脉|把脉|怀孕|有喜|喜脉|身子|身孕|怀上)/.test(String(say || ''))) {
        const hereQ = Object.values(wQ.actors || {}).filter(
          (a) => a && !a.dead && a.id !== 'husband'
            && (a.location === meQ?.location || a.household || a.id === this._viewerActorId),
        );
        const preg = hereQ.filter((a) => a.pregnancy && !a.pregnancy.born);
        const askedWho = hereQ.find((a) => {
          if (!a.name) return false;
          const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
          return String(say || '').includes(a.name) || String(say || '').includes(short);
        });
        if (askedWho && askedWho.pregnancy && !askedWho.pregnancy.born) {
          contextHint += `（【诊脉】${askedWho.name}确有身孕，已 ${askedWho.pregnancy.days || 0} 天。这是账本事实，不许说没有。）\\n`;
        } else if (askedWho) {
          contextHint += `（【诊脉】${askedWho.name}没有身孕。这是账本事实，不许说有了。）\\n`;
        } else if (preg.length) {
          contextHint += `（【诊脉】府里/身边有孕的：${preg.map((a) => `${a.name}（${a.pregnancy.days || 0} 天）`).join('、')}。这是账本事实。）\\n`;
        } else {
          contextHint += '（【诊脉】府里眼下没有谁有身孕。这是账本事实，不许编一个有孕的。）\\n';
        }
      }
    } catch { /* 忽略 */ }"""

norm_content = content.replace('\r\n', '\n')
norm_target = target.replace('\r\n', '\n')
norm_replacement = replacement.replace('\r\n', '\n')

if norm_target in norm_content:
    new_content = norm_content.replace(norm_target, norm_replacement, 1)
    with open('src/pet-service.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Replacement success!')
else:
    print('Target not found!')

