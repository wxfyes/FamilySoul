with open('src/world/summarize.js', 'r', encoding='utf-8') as f:
    c_sum = f.read()

# 1. 修复 summarize.js 中的错误关系灌输
old_sum_line = "lines.push('【你认得的人】王甯（相公，临江茶坊少东家，你与他相好）——有人叫「王掌柜」「王甯」，说的就是他。');"
new_sum_line = """        if (viewer === 'liuwenxia') {
          lines.push('【你认得的人】你的正牌丈夫是「于子归」（营造行工头，你叫他相公/当家的/子归）；王甯只是临江茶坊少东家，是你的地下相好（私下往来，有人叫「王掌柜」「王甯」说的是他，但王甯绝不是你的相公！）。');
        } else {
          lines.push('【你认得的人】王甯（相公，临江茶坊少东家）——有人叫「王掌柜」「王甯」，说的就是他。');
        }"""

if old_sum_line in c_sum:
    c_sum = c_sum.replace(old_sum_line, new_sum_line)
    with open('src/world/summarize.js', 'w', encoding='utf-8') as f:
        f.write(c_sum)
    print("Successfully patched summarize.js ethics!")
else:
    print("Warning: old_sum_line not found in summarize.js")

# 2. 修复 proxy-actor.js 中王甯妄称紫嫣为娘子
with open('src/world/proxy-actor.js', 'r', encoding='utf-8') as f:
    c_proxy = f.read()

old_proxy_call = "'6. 你与她是相好，称呼她名字（或娘子），不许用「姑娘」「客官」这种生分称呼。"
new_proxy_call = "'6. 你与她是相好（她是于家酒肆老板娘，有正牌丈夫于子归，你绝不可自称相公，也不许叫她娘子！只能亲近地唤她名字「紫嫣」或「文霞」），不许用「姑娘」「客官」这种生分称呼。"

if old_proxy_call in c_proxy:
    c_proxy = c_proxy.replace(old_proxy_call, new_proxy_call)
    with open('src/world/proxy-actor.js', 'w', encoding='utf-8') as f:
        f.write(c_proxy)
    print("Successfully patched proxy-actor.js ethics!")
else:
    print("Warning: old_proxy_call not found in proxy-actor.js")

# 3. 修复 summon.js 中女眷带相公同行的伦理
with open('src/world/summon.js', 'r', encoding='utf-8') as f:
    c_sumon = f.read()

old_summon_comp = """    // 4.1 如果相公在同场，且说了一起或提到相公
    const hus = world.actors?.husband;
    if (hus && hus.location === curLoc && (isTogether || /(相公|王掌柜|少掌柜|王甯)/.test(text))) {
      companions.push(hus);
    }
    // 4.2 如果明确说了一起（"一起回家"、"咱们走"、"一道回"），同场的配偶/同行者也一同带走
    if (isTogether) {
      const partnerId = (world.chatPartners || {})[selfId];
      const spouseId = me.spouse;
      for (const [id, a] of Object.entries(world.actors || {})) {
        if (!a || a.dead || id === selfId || id === 'husband') continue;
        if (a.location !== curLoc) continue;
        if (id === partnerId || id === spouseId || /于子归|于杰/.test(a.name || '') || a.spouse === selfId) {
          if (!companions.some((c) => c.id === id)) {
            companions.push(a);
            break;
          }
        }
      }
    }"""

new_summon_comp = """    const spouseId = me.spouse;
    const isWifeOfHusband = !spouseId || spouseId === 'husband';
    if (isWifeOfHusband) {
      // 府中妻妾（婉儿、芸娘）：相公是王甯
      const hus = world.actors?.husband;
      if (hus && hus.location === curLoc && (isTogether || /(相公|王掌柜|少掌柜|王甯)/.test(text))) {
        companions.push(hus);
      }
    } else {
      // 外室相好（如紫嫣）：正牌丈夫是于子归，提相公带于子归
      const realSpouse = world.actors?.[spouseId] || Object.values(world.actors || {}).find((a) => /于子归|于杰/.test(a?.name || ''));
      if (realSpouse && realSpouse.location === curLoc && (isTogether || /(相公|当家的|丈夫|我男人|子归)/.test(text))) {
        if (!companions.some((c) => c.id === realSpouse.id)) companions.push(realSpouse);
      }
      // 只有明确提到王掌柜/王甯时，才带情郎王甯
      const hus = world.actors?.husband;
      if (hus && hus.location === curLoc && /(王掌柜|少掌柜|王甯)/.test(text)) {
        companions.push(hus);
      }
    }
    if (isTogether) {
      const partnerId = (world.chatPartners || {})[selfId];
      for (const [id, a] of Object.entries(world.actors || {})) {
        if (!a || a.dead || id === selfId || id === 'husband') continue;
        if (a.location !== curLoc) continue;
        if (id === partnerId || id === spouseId || /于子归|于杰/.test(a.name || '') || a.spouse === selfId) {
          if (!companions.some((c) => c.id === id)) {
            companions.push(a);
            break;
          }
        }
      }
    }"""

if old_summon_comp in c_sumon:
    c_sumon = c_sumon.replace(old_summon_comp, new_summon_comp)
    with open('src/world/summon.js', 'w', encoding='utf-8') as f:
        f.write(c_sumon)
    print("Successfully patched summon.js companion ethics!")
else:
    print("Warning: old_summon_comp not found in summon.js")

# 4. 修复 pet-service.js 中代演王甯的触发条件（绝不能把紫嫣喊的相公当成王甯！）
with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    c_pet = f.read()

old_pet_name = "const namedHim = /(王甯|王掌柜|少掌柜|相公)/.test(said);"
new_pet_name = """        const isHusbandActor = mePost?.spouse === 'husband' || mePost?.household;
        // 伦理铁律：紫嫣的正牌丈夫是于子归！只有府内妻妾喊相公才是叫王甯；紫嫣喊相公是叫于子归！
        const namedHim = isHusbandActor ? /(王甯|王掌柜|少掌柜|相公)/.test(said) : /(王甯|王掌柜|少掌柜)/.test(said);
        // 若紫嫣喊了相公/当家的/子归，明确记录为找正牌丈夫于子归
        const namedSpouse = !isHusbandActor && /(相公|当家的|丈夫|我男人|子归|于工头|于子归)/.test(said);"""

if old_pet_name in c_pet:
    c_pet = c_pet.replace(old_pet_name, new_pet_name)
    with open('src/pet-service.js', 'w', encoding='utf-8') as f:
        f.write(c_pet)
    print("Successfully patched pet-service.js namedHim ethics!")
else:
    print("Warning: old_pet_name not found in pet-service.js")

