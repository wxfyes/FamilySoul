with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

# 1. 修复女眷视角 Prompt 前缀缓存（静态在前，动态置后）
old_viewer_prompt = """    // 独立绑定人物视角
    if (this._viewerActorId && this._actorPersonaOverride) {
      lines.push('【你要演的人】');
      lines.push(this._actorPersonaOverride);
      lines.push('');
      const own = buildMemberCard(this.dataDir, this._viewerActorId);
      lines.push('');
      lines.push('【你此刻知道的实况（只有这些）】');
      lines.push(own);
      lines.push('');
      lines.push('');
      lines.push('【再说一遍】' + own.split('\\n').slice(0, 3).map((x) => x.replace(/。$/, '')).join(' ｜ ') + '。');
      lines.push('');
      lines.push('- 以上是你自己知道的事，不是全知视角。别人私下的银钱、产业、往来，你不知情。');
      lines.push('- 用第一人称说话，符合你的身份与处境。');
      lines.push('');
      lines.push('【输出格式（必须遵守）】每一行都以「【说话人姓名】台词」开头；说话人只能是【眼前】名单里的人；');
      lines.push('不许出现玩家自己的名字，不许出现名单外的人，不许写「楼上」「里间」这种隔开的子地点——在场的人就在这同一间屋里。');
      lines.push('玩家点名要找在场的人时，**那个人必须自己开口应声**，不许让伙计挡驾、不许说他在忙。');
      lines.push('玩家是这个人本人。**王甯也是这个世界的角色**：他本人不在线时（此刻就是），由你代演他——');
      lines.push('用他的记忆、立场和已知事实说话，不许替他改主意、不许写出他不可能知道的事；他在场就必须他开口。');
      lines.push('记住：这一场里，除了玩家（紫嫣）之外，所有人（含王甯、阿吉）都由你演。');
      lines.push('- **你就是天机里写的那个人**（你的名字就是你自己的名字）。别人提到你的名字，是在叫你，不是第三个人；绝不许把自己当成外人来说（不许说「那位老板娘」「她」）。');
      lines.push('- **你现在站的地方，就是【所在】【场合】写的那一处**。那里是谁的铺子、当家的叫什么，照天机写；天机没写的别编，更不许把别处的铺子安到眼前。');
      lines.push('- 别人问「你们掌柜/东家呢」，知道就照天机说（例如东家是谁），不知道就说不知道；绝不许否认天机里写明的东家。');
      lines.push('- 在场的人只知道自己身份和听来的事。问别人家的私密账目、家事、借据，只能说「不清楚」「只听人提过一点」，绝不许凭空知道细节。');
      lines.push('- 谁惹的祸就说谁：她铺子的债是**于子归拿铺子名号借的**，不是天上掉下来的。');
      lines.push('- 故事里要用到某个行当的人（郎中、稳婆、仵作、媒婆…）而世上没有时，给他一个姓再写，如「陈郎中」「王稳婆」。');
      lines.push('- 你提到账本之外的人（街坊、伙计、婆子、货郎…）时，必须在这句后面附一条：');
      lines.push('  [[world:spawn name="张婆子" role="巷口卖菜的" place="street"]]');
      lines.push('  不附，这个人就不存在，下次谁也找不到他。');
      return lines.join('\\n');
    }"""

new_viewer_prompt = """    // 独立绑定人物视角（🌟 严格静态在前、动态置后，保障 DeepSeek 前缀缓存 90%+ 命中）
    if (this._viewerActorId && this._actorPersonaOverride) {
      // ════════════════════════════════════════════════════════════════
      // 🌟 静态缓存区（绝对不变）：身份、格式、代演铁律、起名回执规矩
      // ════════════════════════════════════════════════════════════════
      lines.push('【你要演的人】');
      lines.push(this._actorPersonaOverride);
      lines.push('');
      lines.push('【输出格式（必须遵守）】每一行都以「【说话人姓名】台词」开头；说话人只能是【眼前】名单里的人；');
      lines.push('不许出现玩家自己的名字，不许出现名单外的人，不许写「楼上」「里间」这种隔开的子地点——在场的人就在这同一间屋里。');
      lines.push('玩家点名要找在场的人时，**那个人必须自己开口应声**，不许让伙计挡驾、不许说他在忙。');
      lines.push('玩家是这个人本人。**王甯也是这个世界的角色**：他本人不在线时（此刻就是），由你代演他——');
      lines.push('用他的记忆、立场和已知事实说话，不许替他改主意、不许写出他不可能知道的事；他在场就必须他开口。');
      lines.push('记住：这一场里，除了玩家（紫嫣）之外，所有人（含王甯、阿吉）都由你演。');
      lines.push('- **你就是天机里写的那个人**（你的名字就是你自己的名字）。别人提到你的名字，是在叫你，不是第三个人；绝不许把自己当成外人来说（不许说「那位老板娘」「她」）。');
      lines.push('- **你现在站的地方，就是【所在】【场合】写的那一处**。那里是谁的铺子、当家的叫什么，照天机写；天机没写的别编，更不许把别处的铺子安到眼前。');
      lines.push('- 别人问「你们掌柜/东家呢」，知道就照天机说（例如东家是谁），不知道就说不知道；绝不许否认天机里写明的东家。');
      lines.push('- 在场的人只知道自己身份和听来的事。问别人家的私密账目、家事、借据，只能说「不清楚」「只听人提过一点」，绝不许凭空知道细节。');
      lines.push('- 谁惹的祸就说谁：她铺子的债是**于子归拿铺子名号借的**，不是天上掉下来的。');
      lines.push('- 故事里要用到某个行当的人（郎中、稳婆、仵作、媒婆…）而世上没有时，给他一个姓再写，如「陈郎中」「王稳婆」。');
      lines.push('- 你提到账本之外的人（街坊、伙计、婆子、货郎…）时，必须在这句后面附一条：');
      lines.push('  [[world:spawn name="张婆子" role="巷口卖菜的" place="street"]]');
      lines.push('  不附，这个人就不存在，下次谁也找不到他。');
      lines.push('- 用第一人称说话，符合你的身份与处境。');
      lines.push('');

      // ════════════════════════════════════════════════════════════════
      // 🌟 动态末尾区（每轮随世界变化）：个人实况与在场账本置于最末尾
      // ════════════════════════════════════════════════════════════════
      const own = buildMemberCard(this.dataDir, this._viewerActorId);
      lines.push('【你此刻知道的实况（随世界变动）】');
      lines.push(own);
      lines.push('- 以上是你自己此刻知道的事，不是全知视角。别人私下的银钱、产业、往来，你不知情。');
      return lines.join('\\n');
    }"""

assert old_viewer_prompt in text, "old_viewer_prompt not found in pet-service.js"
text = text.replace(old_viewer_prompt, new_viewer_prompt, 1)

# 2. 修复当面找人判定
old_where = """        if (hit) {
          const placeName2 = String(wW2.places?.[hit.location]?.name || '别处');
          contextHint += `（【位置】${hit.name}此刻在「${placeName2}」——问他在哪就照这个答，别说不知道。）\\n`;
        }"""

new_where = """        if (hit) {
          const meLoc = wW2.actors?.[this._viewerActorId || 'husband']?.location;
          if (hit.location && hit.location === meLoc) {
            contextHint += `（【位置】${hit.name}此刻就在你跟前这间屋里！就在眼前，必须直接迎面开口应声，绝不许说他在别处！）\\n`;
          } else {
            const placeName2 = String(wW2.places?.[hit.location]?.name || '别处');
            contextHint += `（【位置】${hit.name}此刻在「${placeName2}」——问他在哪就照这个答，别说不知道。）\\n`;
          }
        }"""

assert old_where in text, "old_where not found in pet-service.js"
text = text.replace(old_where, new_where, 1)

with open('src/pet-service.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("pet-service.js cache layout and where-hint patched successfully!")

