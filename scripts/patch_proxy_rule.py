import io

# 身份卡：王甯那一行改成"由你代演"
p = 'src/world/member-card.js'
s = io.open(p, encoding='utf-8-sig').read()

s = s.replace(
    "    return `【王甯】你的相好，临江茶坊东家，此刻就在你跟前。`;",
    "    return `【王甯】你的相好，临江茶坊东家，此刻就在你跟前（他本人不在线，由你代演他）。`;",
)
s = s.replace(
    "  return `【王甯】你的相好，临江茶坊东家，此刻在「${place}」，不在这儿。`;",
    "  return `【王甯】你的相好，临江茶坊东家，此刻在「${place}」，不在这儿（他本人不在线，通篇由你代演他）。`;",
)
io.open(p, 'w', encoding='utf-8').write(s)
print('patched card')

# 提示词：代演规则
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
anchor = "      lines.push('玩家是这个人本人，**王甯不是玩家，他由你来演**；他在这屋里，就得他开口说话。');"
new = (
    "      lines.push('玩家是这个人本人。**王甯也是这个世界的角色**：他本人不在线时（此刻就是），由你代演他——');\n"
    "      lines.push('用他的记忆、立场和已知事实说话，不许替他改主意、不许写出他不可能知道的事；他在场就必须他开口。');\n"
    "      lines.push('记住：这一场里，除了玩家（紫嫣）之外，所有人（含王甯、阿吉）都由你演。');\n"
)
if anchor in s2:
    s2 = s2.replace(anchor, new)
    print('patched prompt: proxy rule')
else:
    print('WARN: anchor not found')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
