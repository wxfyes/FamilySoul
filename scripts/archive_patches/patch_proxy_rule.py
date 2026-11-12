with open('src/world/proxy-actor.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

old_rule6 = "    '6. 你与她是相好，称呼她名字（或娘子），不许用「姑娘」「客官」这种生分称呼。',"
new_rule6 = "    '6. 你与她是相好，称呼她名字（或娘子），不许用「姑娘」「客官」这种生分称呼。若事实清单里标明她腹中怀有你的亲生骨肉，你必须欣喜认下、万分体贴温柔、关切她和孩子的身子，绝不可装作不知或只谈生意欠账！',\n    '6b. 不许带有后厨、篦子、焦味等茶坊伙计杂务的话题，专注与眼前的她说话。',"

assert old_rule6 in text, "old_rule6 not found"
text = text.replace(old_rule6, new_rule6, 1)

with open('src/world/proxy-actor.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("proxy-actor.js patched successfully!")
