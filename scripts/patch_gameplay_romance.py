with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. 替换总提示词里的地下情人写死
target1 = """      lines.push('【城中暗香 · 深宅怨妇地下情人谱系（杨采云、刘文霞、战静）】');
      lines.push('- 翟家货栈老板娘【杨采云】、于家酒肆老板娘【刘文霞】、典吏随科之妻【战静】，皆为相公地下情人，借采办或幽会私相授受情报与暗账；在外端庄体面，幽会时极尽娇媚痴缠。');"""

replacement1 = """      lines.push('【城中人物 · 人妻名媛与外室攻略铁律（战静、杨采云、苏慕雪、刘文霞等）】');
      lines.push('- 典吏随科之发妻【战静】、翟家货栈老板娘【杨采云】、于家酒肆老板娘【刘文霞】、名门望族才女人妻【苏慕雪】等，皆各有原夫或名门名节！');
      lines.push('- 【绝对严禁开局白给，保留真实攻略乐趣】：她们并非一开始就是相公的情人！在外一律恪守妇德礼节，端庄清冷，视相公王甯为茶商外人；必须由相公通过实际接触、商业博弈、查明亏空、互助攻心逐步攻略！言谈举止严格取决于关系账本，绝不可未攻略就投怀送抱、自称妾身相公、娇媚痴缠！');"""

if target1 in text:
    text = text.replace(target1, replacement1)
    print("Successfully replaced target1 (general prompt)!")
else:
    print("Warning: target1 not found!")

# 2. 替换接话分身 notice 中的写死攻克
target2 = """        } else if (!haremNotice && /采云|杨采云|翟长盛|翟家货栈/i.test(say)) {
          targetSpeaker = '杨采云';
          haremNotice = '（【当前接话分身：深宅地下情人·杨采云（临江翟家大货栈老板娘）】：丈夫翟长盛嗜酒好赌夜夜宿娼，采云满心委屈独守空房，早已被少掌柜王甯彻底攻破身心！此刻在茶坊二楼雅阁（或后山秘苑）与王甯私会，满怀依恋与柔情，向相公倾吐相思与货栈账目！）';
        } else if (!haremNotice && /文霞|刘文霞|于杰|城南酒肆/i.test(say)) {
          targetSpeaker = '刘文霞';
          haremNotice = '（【当前接话分身：深宅地下情人·刘文霞（城南于家酒肆老板娘）】：丈夫于杰自命风流整夜宿在画舫，文霞生得雪白丰腴、熟美如蜜桃，早已沦为相公专属的地下情人！在相公面前尽显少妇熟透的娇媚与痴缠，汇报茶酒订单与城南暗账！）';
        } else if (!haremNotice && /战静|随科|随典史/i.test(say)) {
          targetSpeaker = '战静';
          haremNotice = '（【当前接话分身：深宅地下情人·战静（县衙典吏随科之妻）】：丈夫随科嗜酒宿娼冷暴力，战静平日清冷高傲，唯独在相公王甯面前被男子气概融化，如胶似漆、死心塌地！向相公透露县衙税契与差役风声！）';"""

replacement2 = """        } else if (!haremNotice && /采云|杨采云|翟长盛|翟家货栈/i.test(say)) {
          targetSpeaker = '杨采云';
          haremNotice = '（【当前接话分身：货栈大娘子·杨采云】：临江翟家大货栈老板娘，精明干练的商贾人妻！面对王甯时，按账本好感度回话：若好感未满，言谈公事公办、客套精明，不卑不亢谈茶货；若已被相公攻心动情，方显露深闺委屈与柔情！）';
        } else if (!haremNotice && /文霞|刘文霞|于杰|城南酒肆/i.test(say)) {
          targetSpeaker = '刘文霞';
          haremNotice = '（【当前接话分身：于家酒肆老板娘·刘文霞（紫嫣）】：丈夫于杰在外做工，文霞泼辣精明又生得雪白丰腴，守着于家酒肆的门面！因借了王甯银两而多有交集，但名分上始终是于家妇，对王甯带着市井少妇的机敏防备与娇嗔试探，绝非开局投怀送抱！）';
        } else if (!haremNotice && /战静|随科|随典史|静儿/i.test(say)) {
          targetSpeaker = '战静';
          haremNotice = '（【当前接话分身：县衙书吏发妻·战静】：知书识礼、清冷端庄的官眷少妇！丈夫随科嗜酒混账，战静内心受尽冷落委屈，但极度在意外界名节妇德！对王掌柜保持男女之防，言语清冷疏离、称呼「王掌柜」，等待相公真正以智谋与温情一步步攻破心防，绝不可未攻略就喊相公投怀送抱！）';
        } else if (!haremNotice && /苏慕雪|慕雪|书院山长/i.test(say)) {
          targetSpeaker = '苏慕雪';
          haremNotice = '（【当前接话分身：书院人妻·苏慕雪】：温婉端庄、知性高雅的名门贵妇，书香门第，知书达理！言谈间尽显知性矜持与文人雅趣，视王甯为品茗论道的茶商知己，严守礼制大防，需要相公逐步攻略！）';"""

if target2 in text:
    text = text.replace(target2, replacement2)
    print("Successfully replaced target2 (speaker notices)!")
else:
    print("Warning: target2 not found!")

# 3. 替换幽会铁律中的死攻克法则
target3 = """      } else if (/杨采云|采云|翟长盛|刘文霞|文霞|于杰|战静|随科|随典史/i.test(say)) {
        currentEpoch = 'ancient';
        contextHint = `（【深闺暗香 · 城外/雅室地下幽会与红粉内应法则】：
相公此刻正与地下情人私会（相公说：“${say}”）！
【天道最高幽会铁律 · 物理空间绝对隔离】：
1. **专属私密幽会空间**：场景为【临江茶坊二楼临窗秘阁】、【紫阳山后山竹林别苑】、【画舫私舱】或【趁夫婿不归时的深闺幽室】；【绝对严禁正妻婉儿、芸娘或茶坊内宅妻妾在场插话】！
2. **完全被相公身心攻克**：严格遵照角色卡中该佳人（杨采云、刘文霞、战静）之出身与原夫恶习！她们对夜夜宿娼烂醉的丈夫心灰意冷，在相公王甯面前展现出大少妇特有的偷情娇怯、反差与死心塌地！
3. **主动呈递暗线助力**：借私会之机，依偎在相公怀中千娇百媚、温存倾诉，并主动向相公透露其夫婿货栈/酒肆/衙门账目底价与江湖情报！）`;"""

replacement3 = """      } else if (/杨采云|采云|翟长盛|刘文霞|文霞|于杰|战静|随科|随典史|苏慕雪/i.test(say)) {
        currentEpoch = 'ancient';
        contextHint = `（【宿命乾坤 · 人妻名媛与有夫之妇攻略博弈法则】：
相公此刻正与有夫之妇/城中名媛交涉（相公说：“${say}”）！
【核心攻略铁律 · 杜绝开局白给，保留真实攻略乐趣】：
1. **名节与防线（攻略前）**：她们皆是有夫之妇或望族名媛，恪守妇德礼节，深知男女之防！言谈以客套、生疏、公事公办为主，称呼相公为「王掌柜」或「王少东」，绝不会平白无故投怀送抱、依偎撒娇或死心塌地！
2. **攻略过程**：相公必须展现眼界、智谋、担当，或替她们化解原夫带来的困境与羞辱，她们内心的坚冰才会随着好感度提升一层层融化；
3. **分层台词**：初见生疏自持；略有好感时欲迎还拒、微露羞怯与委屈；唯有当好感度极高且经历关键事件彻底沦陷后，才会私相授受、成为相公生死相随的红粉知己！）`;"""

if target3 in text:
    text = text.replace(target3, replacement3)
    print("Successfully replaced target3 (contextHint rules)!")
else:
    print("Warning: target3 not found!")

with open('src/pet-service.js', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated pet-service.js successfully!")

