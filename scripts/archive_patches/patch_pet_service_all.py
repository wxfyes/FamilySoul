import os

# 1. Patch src/pet-service.js: syncSceneFromReply (雅阁归并)
with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

old_scene = """      let placeId = Object.keys(world.places || {}).find((id) => {
        const n = world.places[id]?.name || '';
        return n === placeName || n === headName;
      });"""

new_scene = """      // 「雅阁/二楼雅阁/雅间」是临江茶坊的茶室，归并到 tea_house，严禁另建独立地点
      let placeId = null;
      if (/^(雅阁|二楼雅阁|茶坊雅阁|茶阁|雅间)$/.test(headName) || /^(雅阁|二楼雅阁|茶坊雅阁|茶阁|雅间)$/.test(placeName)) {
        if (world.places?.tea_house) {
          placeId = 'tea_house';
          placeName = world.places.tea_house.name || '临江茶坊';
          headName = placeName;
        }
      }
      if (!placeId) {
        placeId = Object.keys(world.places || {}).find((id) => {
          const n = world.places[id]?.name || '';
          return n === placeName || n === headName;
        });
      }"""

assert old_scene in text, "old_scene not found!"
text = text.replace(old_scene, new_scene, 1)

# 2. Patch src/pet-service.js: extractReceipt
old_receipt = """      const system = [
        '你是世界账本记账员。判断这一轮有没有改变世界，只输出回执行，不要解释、不要写台词。',
        `在场人物：${roster}`,
        `产业清单：${props}`,
        '格式：[[world:relation who=waner field=trust delta=+3]] [[world:asset delta=-12.5 reason="x"]] [[world:promise due=世界日+天数 text="x"]] [[world:move who=husband to=地点]] [[world:remember text="一句话"]]',
        '剧情线：[[world:clue text="沈家旧案的一页卷宗"]] [[world:faction id=yamen delta=+5]]',
        '新人物：[[world:spawn name="苏娘" role="绣坊寡妇" goals="养大幼子;寻个依靠" secret="亡夫留了债"]]',
        '有孕：[[world:pregnant who=liuwenxia]]（她自己说/大夫诊出/相公确认才算）',"""

new_receipt = """      const curSpeaker = (this._viewerActorId && w0?.actors?.[this._viewerActorId]?.name) || (memberKey === 'husband' ? '相公王甯' : '女眷');
      const system = [
        '你是世界账本记账员。判断这一轮有没有改变世界，只输出回执行，不要解释、不要写台词。',
        `在场人物：${roster}`,
        `产业清单：${props}`,
        this._viewerActorId ? `【重要角色识别】：当前说话者是「${curSpeaker}」（id=${this._viewerActorId}）。当她说自己怀有身孕时，必须记 [[world:pregnant who=${this._viewerActorId}]]，绝不许记给在场的其他女眷！` : '',
        '格式：[[world:relation who=waner field=trust delta=+3]] [[world:asset delta=-12.5 reason="x"]] [[world:promise due=世界日+天数 text="x"]] [[world:move who=husband to=地点]] [[world:remember text="一句话"]]',
        '剧情线：[[world:clue text="沈家旧案的一页卷宗"]] [[world:faction id=yamen delta=+5]]',
        '新人物：[[world:spawn name="苏娘" role="绣坊寡妇" goals="养大幼子;寻个依靠" secret="亡夫留了债"]]',
        '有孕：[[world:pregnant who=liuwenxia]]（她自己说/大夫诊出/相公确认才算；谁说自己有孕就记谁，绝不可张冠李戴）',"""

assert old_receipt in text, "old_receipt not found!"
text = text.replace(old_receipt, new_receipt, 1)

old_complete = """      const res = await this.llmClient.complete({
        system,
        messages: [{ role: 'user', content: `相公说：${userText}\\n她回：${replyText}` }],
        maxTokens: 150,
        temperature: 0.2,
      });"""

new_complete = """      const speakerLabel = this._viewerActorId ? `${curSpeaker}说` : '相公说';
      const replyLabel = this._viewerActorId ? '对方回' : '她回';
      const res = await this.llmClient.complete({
        system,
        messages: [{ role: 'user', content: `${speakerLabel}：${userText}\\n${replyLabel}：${replyText}` }],
        maxTokens: 150,
        temperature: 0.2,
      });"""

assert old_complete in text, "old_complete not found!"
text = text.replace(old_complete, new_complete, 1)

with open('src/pet-service.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("pet-service.js patched successfully!")

