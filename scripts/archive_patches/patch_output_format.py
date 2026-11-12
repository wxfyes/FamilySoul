import io

# 1) 她那侧：格式硬要求
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      lines.push('- 用第一人称说话，符合你的身份与处境。');"
add = (
    "      lines.push('');\n"
    "      lines.push('【输出格式（必须遵守）】每一行都以「【说话人姓名】台词」开头；说话人只能是【眼前】名单里的人；');\n"
    "      lines.push('不许出现玩家自己的名字，不许出现名单外的人，不许写「楼上」「里间」这种隔开的子地点——在场的人就在这同一间屋里。');\n"
    "      lines.push('玩家点名要找在场的人时，**那个人必须自己开口应声**，不许让伙计挡驾、不许说他在忙。');\n"
)
if anchor in s and '【输出格式（必须遵守）】' not in s:
    s = s.replace(anchor, anchor + "\n" + add, 1)
    print('added output format rules')
else:
    print('WARN: anchor not found or already added')

io.open(p, 'w', encoding='utf-8').write(s)

# 2) 身份卡：禁止子地点
p2 = 'src/world/member-card.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old = "王甯在场时，你找他他就得自己开口，不许让伙计挡驾。"
new = "王甯在场时，你找他他就得自己开口，不许让伙计挡驾。这屋里没有楼上楼下之分，在场的人都在这同一间。"
if old in s2:
    s2 = s2.replace(old, new)
    print('patched card: no sub-locations')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
