with open('src/world/member-reply.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

old_sp = """    if (isSelfSpeaker) {
      if (ctx?.husbandPresent || /(去寻你|看着店|等我|等相公|娘子|找你|回酒肆)/.test(body)) {
        sp = '王甯'; // 智能纠正为相公王甯说话，绝不让玩家自己回复自己
      } else {
        continue; // 丢掉由真人控制的角色台词
      }
    }"""

new_sp = """    if (isSelfSpeaker) {
      if (ctx?.husbandPresent || /(去寻你|看着店|等我|等相公|娘子|找你|回酒肆)/.test(body)) {
        sp = '王甯'; // 智能纠正为相公王甯说话，绝不让玩家自己回复自己
      } else {
        continue; // 丢掉由真人控制的角色台词
      }
    }

    // 若其他女眷（如沈婉儿、林芸娘）冒出相公口吻称呼"叫娘子"或轻抚手等相公举动，智能纠正为相公王甯
    if (/^(沈婉儿|婉儿|林芸娘|芸娘|小翠)$/.test(sp) && /(叫娘子|唤你娘子|轻抚.*的手|为夫|耽搁些时日)/.test(body)) {
      sp = '王甯';
    }"""

assert old_sp in text, "old_sp not found in member-reply.js"
text = text.replace(old_sp, new_sp, 1)

with open('src/world/member-reply.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("member-reply.js patched successfully!")

