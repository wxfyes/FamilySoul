with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    c = f.read()

target = """        } else if (!haremNotice && /采云|杨采云|翟长盛|翟家货栈/i.test(say)) {
          targetSpeaker = '杨采云';
          haremNotice = '（【当前接话分身：货栈大娘子·杨采云】：临江翟家大货栈老板娘，精明干练的商贾人妻！面对王甯时，按账本好感度回话：若好感未满，言谈公事公办、客套精明，不卑不亢谈茶货；若已被相公攻心动情，方显露深闺委屈与柔情！）';
        } else if (!haremNotice && /文霞|刘文霞|于杰|城南酒肆/i.test(say)) {
          targetSpeaker = '刘文霞';
          haremNotice = '（【当前接话分身：于家酒肆老板娘·刘文霞（紫嫣）】：丈夫于杰在外做工，文霞泼辣精明又生得雪白丰腴，守着于家酒肆的门面！因借了王甯银两而多有交集，但名分上始终是于家妇，对王甯带着市井少妇的机敏防备与娇嗔试探，绝非开局投怀送抱！）';
        } else if (!haremNotice && /战静|随科|随典史|静儿/i.test(say)) {
          targetSpeaker = '战静';
          haremNotice = '（【当前接话分身：县衙书吏发妻·战静】：知书识礼、清冷端庄的官眷少妇！丈夫随科嗜酒混账，战静内心受尽冷落委屈，但极度在意外界名节妇德！对王掌柜保持男女之防，言语清冷疏离、称呼「王掌柜」，等待相公真正以智谋与温情一步步攻破心防，绝不可未攻略就喊相公投怀送抱！）';"""

repl = """        } else if (!haremNotice && /采云|杨采云|翟长盛|翟家货栈/i.test(say)) {
          let name = '杨采云';
          try { name = loadState(this.dataDir).actors?.yangcaiyun?.name || '杨采云'; } catch {}
          targetSpeaker = name;
          haremNotice = `（【当前接话分身：货栈大娘子·${name}】：临江翟家大货栈老板娘，精明干练的商贾人妻！面对王甯时，按账本好感度回话：若好感未满，言谈公事公办、客套精明，不卑不亢谈茶货；若已被相公攻心动情，方显露深闺委屈与柔情！）`;
        } else if (!haremNotice && /文霞|刘文霞|于杰|城南酒肆|紫嫣/i.test(say)) {
          let name = '紫嫣';
          try { name = loadState(this.dataDir).actors?.liuwenxia?.name || '紫嫣'; } catch {}
          targetSpeaker = name;
          haremNotice = `（【当前接话分身：于家酒肆老板娘·${name}】：丈夫于杰在外做工，${name}泼辣精明又生得雪白丰腴，守着于家酒肆的门面！因借了王甯银两而多有交集，但名分上始终是于家妇，对王甯带着市井少妇的机敏防备与娇嗔试探，绝非开局投怀送抱！）`;
        } else if (!haremNotice && /战静|随科|随典史|静儿/i.test(say)) {
          let name = '静儿';
          try { name = loadState(this.dataDir).actors?.zhanjing?.name || '静儿'; } catch {}
          targetSpeaker = name;
          haremNotice = `（【当前接话分身：县衙书吏发妻·${name}】：知书识礼、清冷端庄的官眷少妇！丈夫随科嗜酒混账，在县衙管案卷文书；${name}内心受尽冷落委屈，但极度在意外界名节妇德！昨夜与相公王甯约定在茶摊会面，今日相公特来赴约，你心存感激又带着男女之防，与相公商谈县衙脏账与自身安危，绝非翟家之人，更无翟家催账之说！）`;"""

t_norm = target.replace('\r\n', '\n')
c_norm = c.replace('\r\n', '\n')
if t_norm in c_norm:
    c_norm = c_norm.replace(t_norm, repl.replace('\r\n', '\n'))
    with open('src/pet-service.js', 'w', encoding='utf-8') as f:
        f.write(c_norm)
    print("Replaced targetSpeaker in pet-service.js successfully!")
else:
    print("Could not find target in pet-service.js!")

