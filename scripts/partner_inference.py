import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 于杰/于子归 不能被王甯说成自己身边的人 → 删句
old = "                const others = ['婉儿', '芸娘', '小翠', '苏慕雪', '杨采云', '静儿', '杨采儿', '苏娘'];"
new = "                const others = ['婉儿', '芸娘', '小翠', '苏慕雪', '杨采云', '静儿', '杨采儿', '苏娘', '于杰', '于子归'];"
if old in s:
    s = s.replace(old, new)
    print('patched: drop sentences naming her husband')

# ② 谁说了话，就把对话对象记成谁（不论主模型还是代演）
anchor = "    // 有人应过声，就别再留\"没人接话\""
block = (
    "    // 记下这一轮是谁在说话：下一句接着他说\n"
    "    try {\n"
    "      if (this._viewerActorId && reply) {\n"
    "        const spoken = String(reply).match(/【([^】]+)】/g) || [];\n"
    "        const names = spoken.map((x) => x.replace(/[【】]/g, '')).filter((n) => n && !/(屋里|街|茶坊|酒肆|府衙|码头|河|院|门|街面上)/.test(n));\n"
    "        if (names.length) {\n"
    "          const last = names[names.length - 1];\n"
    "          const wp3 = loadState(this.dataDir);\n"
    "          const hit = Object.values(wp3.actors || {}).find((a) => a && a.name === last);\n"
    "          if (hit) {\n"
    "            wp3.chatPartners = wp3.chatPartners || {};\n"
    "            wp3.chatPartners[this._viewerActorId] = hit.id;\n"
    "            saveState(this.dataDir, wp3);\n"
    "          }\n"
    "        }\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 有人应过声，就别再留\"没人接话\""
)
if anchor in s and '记下这一轮是谁在说话' not in s:
    s = s.replace(anchor, block, 1)
    print('patched: infer partner from reply speakers')

# ③ 引入 resolveTurnTarget
if 'resolveTurnTarget' not in s.split("\n\n")[0]:
    s = s.replace(
        "import { normalizeMemberReply } from './world/member-reply.js';",
        "import { normalizeMemberReply } from './world/member-reply.js';\nimport { resolveTurnTarget } from './world/turn-target.js';",
        1,
    )
    print('imported resolveTurnTarget')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
