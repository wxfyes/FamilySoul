import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 记账员：把 spawn 提到最前面，格式明确
old = "        '**对话里第一次出现有名有姓、有身份的新人物，必须 spawn**，否则她只是嘴上说说、不会活在世上。',"
new = (
    "        '**本轮回复里只要出现账本没有的人名（哪怕是别人嘴里提到的），就要输出 spawn 回执**，格式：',\n"
    "        '  [[world:spawn name=\"柳三娘\" role=\"挑担卖花的\" place=\"street\"]]',\n"
    "        '  role 从他做的事推断，place 用对话里说的地点（street/tea_house/dock/wine_shop 等）。不输出就等于这个人不存在。',"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: spawn rule first')

# ② 她的号：主模型自己也得会写 spawn（同步回执）
anchor = "      lines.push('- 谁惹的祸就说谁：她铺子的债是**于子归拿铺子名号借的**，不是天上掉下来的。');"
add = (
    "\n"
    "      lines.push('- 你提到账本之外的人（街坊、伙计、婆子、货郎…）时，必须在这句后面附一条：');\n"
    "      lines.push('  [[world:spawn name=\"张婆子\" role=\"巷口卖菜的\" place=\"street\"]]');\n"
    "      lines.push('  不附，这个人就不存在，下次谁也找不到他。');"
)
if anchor in s and '必须在这句后面附一条' not in s:
    s = s.replace(anchor, anchor + add, 1)
    print('patched: main model must spawn new faces')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
