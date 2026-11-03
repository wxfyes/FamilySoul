with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """        if (primaryOutFemale.id === 'liuwenxia' || primaryOutFemale.name === '刘文霞' || primaryOutFemale.name === '紫嫣') {
          const isPreg = primaryOutFemale.pregnancy && !primaryOutFemale.pregnancy.born;
          lines.push(`- 你的专属身份：于家酒肆老板娘【紫嫣/刘文霞】！成熟风韵、蜜桃熟透、柔媚多情。你与相公早已暗度陈仓${isPreg ? '，肚里已怀有相公的骨肉！' : '！'}面对相公时，嘴上虽有几分小门小户的推脱娇嗔，骨子里对相公死心榻地、极尽痴缠娇媚！自称「奴家/妾身/紫嫣」，称呼王甯为「相公/爷/冤家」！`);
        } else if (primaryOutFemale.id === 'yangcaiyun' || primaryOutFemale.name === '杨采云') {
          lines.push('- 你的专属身份：翟家货栈老板娘【杨采云】！精明风韵少妇，相公地下情人，借采办之名与相公幽会私相授受！');
        } else if (primaryOutFemale.id === 'zhanjing' || primaryOutFemale.name === '战静') {
          lines.push('- 你的专属身份：县衙书吏之妻【战静】！端庄体面之下暗怀春心，与相公私下往来！');
        } else {"""

replacement = """        const rel = primaryOutFemale.relations?.husband || {};
        const isDeepRomance = (rel.trust >= 75 && rel.desire >= 55) || primaryOutFemale.intimacy?.level >= 3;
        if (primaryOutFemale.id === 'zhanjing' || primaryOutFemale.name === '战静') {
          if (isDeepRomance) {
            lines.push('- 你的专属身份：县衙书吏之妻【战静】！历经多次试探与相助，已被王掌柜彻底打动芳心，私下满怀深情；称呼王甯「王郎/相公」，言语温柔含蓄。');
          } else {
            lines.push('- 你的专属身份：县衙典吏随科之发妻【战静】！知书识礼、端庄矜持，极重妇德名声！视王甯为登门客套的茶商，称呼「王掌柜」，言谈谨守男女之防，带着官眷少妇的生疏与防备，绝不可主动套近乎或自称妾身！');
          }
        } else if (primaryOutFemale.id === 'yangcaiyun' || primaryOutFemale.name === '杨采云') {
          if (isDeepRomance) {
            lines.push('- 你的专属身份：翟家货栈老板娘【杨采云】！深闺委屈已被王少东抚平，芳心暗许，借采办商茶之名幽会温存。');
          } else {
            lines.push('- 你的专属身份：翟家货栈大娘子【杨采云】！精明干练的商贾人妻，言语犀利机敏、公事公办谈茶货，称呼「王少东」，不卑不亢，绝无半分轻浮！');
          }
        } else if (primaryOutFemale.id === 'sumuxue' || primaryOutFemale.name === '苏慕雪') {
          if (isDeepRomance) {
            lines.push('- 你的专属身份：名门才女人妻【苏慕雪】！才情交融、红袖添香，视王甯为一生难寻的灵魂知己。');
          } else {
            lines.push('- 你的专属身份：名门望族才女人妻【苏慕雪】！温婉端庄、知性高雅，恪守礼数，视王甯为茶道文友，言辞清雅疏离、发乎情止乎礼。');
          }
        } else if (primaryOutFemale.id === 'liuwenxia' || primaryOutFemale.name === '刘文霞' || primaryOutFemale.name === '紫嫣') {
          const isPreg = primaryOutFemale.pregnancy && !primaryOutFemale.pregnancy.born;
          if (isDeepRomance || isPreg) {
            lines.push(`- 你的专属身份：于家酒肆老板娘【紫嫣/刘文霞】！熟美丰腴、柔媚多情。你与王掌柜私下往来极密${isPreg ? '，肚里已怀有他的骨肉！' : '！'}面对他时娇嗔痴缠，但自知是于家妇，隐秘温存。`);
          } else {
            lines.push('- 你的专属身份：于家酒肆老板娘【紫嫣/刘文霞】！丈夫于子归在营造行做工，自己守着酒肆门面，泼辣机敏！因借了王甯银子而有往来，称呼「王掌柜」，带着市井少妇的精明防备与利落，绝不开局投怀送抱！');
          }
        } else {"""

if target in text:
    text = text.replace(target, replacement)
    with open('src/pet-service.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully replaced primaryOutFemale logic in pet-service.js!")
else:
    print("Target not found in pet-service.js")
