import io

# ① 给"铺子的债"一个真正的原因：于子归拿铺子名号借的钱
p = 'src/world/arcs.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "    if (!world.arcs[id]) {\n"
    "      world.arcs[id] = {\n"
)
new = (
    "    if (!world.arcs[id]) {\n"
    "      // 难关总得有个出处：补一条因果（谁惹的、怎么惹的）\n"
    "      try {\n"
    "        const hasCause = (world.memories || []).some((m) => /于子归.*(借|名号|债)/.test(String(m?.text || '')));\n"
    "        if (!hasCause && id === 'liuwenxia') {\n"
    "          world.memories = Array.isArray(world.memories) ? world.memories : [];\n"
    "          world.memories.push({\n"
    "            text: '于子归拿于家酒肆的名号向钱通海借了一笔银子，工地上赔了，债却记在铺子头上',\n"
    "            day: world.clock?.day || 1,\n"
    "            at: Date.now(),\n"
    "            about: ['liuwenxia', 'yujie'],\n"
    "            visible: 'private',\n"
    "          });\n"
    "          world.clues = Array.isArray(world.clues) ? world.clues : [];\n"
    "          if (!world.clues.some((c) => /于子归.*借/.test(String(c?.text || '')))) {\n"
    "            world.clues.push({\n"
    "              text: '于子归拿于家酒肆名号向钱通海借银，债主找的是铺子',\n"
    "              day: world.clock?.day || 1,\n"
    "              source: '街面风声',\n"
    "              owner: 'liuwenxia',\n"
    "            });\n"
    "          }\n"
    "        }\n"
    "      } catch { /* 忽略 */ }\n"
    "      world.arcs[id] = {\n"
)
if old in s and '难关总得有个出处' not in s:
    s = s.replace(old, new, 1)
    print('added debt cause for liuwenxia arc')
else:
    print('WARN: arc creation block not found')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 旁人不知道的规则（她那一侧的对话）
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
anchor = "      lines.push('- 别人问「你们掌柜/东家呢」，知道就照天机说（例如东家是谁），不知道就说不知道；绝不许否认天机里写明的东家。');"
add = (
    "      lines.push('- 在场的人只知道自己身份和听来的事。问别人家的私密账目、家事、借据，只能说「不清楚」「只听人提过一点」，绝不许凭空知道细节。');\n"
    "      lines.push('- 谁惹的祸就说谁：她铺子的债是**于子归拿铺子名号借的**，不是天上掉下来的。');\n"
)
if anchor in s2 and '在场的人只知道自己身份' not in s2:
    s2 = s2.replace(anchor, anchor + "\n" + add, 1)
    print('added npc knowledge rule')
else:
    print('WARN: npc rule anchor not found')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
