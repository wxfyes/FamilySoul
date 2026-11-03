with open('src/world/summon.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

old_part4 = """  // 4. ④ 缺口四：女眷带相公反向同步（"跟我去医馆"、"随我来后院"）
  if (!isHusband) {
    const hus = world.actors?.husband;
    if (hus && hus.location === me.location) {
      if (isTogether || /(相公|王掌柜|少掌柜|王甯)/.test(text)) {
        companions.push(hus);
      }
    }
  }"""

new_part4 = """  // 4. 女眷带伴侣/同行人同步（"跟我去医馆"、"赶紧弄完一起回家"）
  if (!isHusband) {
    const curLoc = me.location;
    // 4.1 如果相公在同场，且说了一起或提到相公
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
    }
  }"""

assert old_part4 in text, "old_part4 not found in summon.js"
text = text.replace(old_part4, new_part4, 1)

with open('src/world/summon.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("summon.js companion logic updated successfully!")

