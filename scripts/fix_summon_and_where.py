import io

# ① summon：只有明确"去/找/见/叫/来"，才动位置或把人叫来；光提名字不动
p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "  const mentioned = findMentioned(world, say);"
new = (
    "  // 光提名字不算\"去找\"：必须有动作词才算\n"
    "  const hasMoveVerb = /(去|往|找|寻|见|到|过来|叫|请|来|上|回)/.test(say);\n"
    "  const mentioned = hasMoveVerb ? findMentioned(world, say) : [];\n"
)
if old in s and 'hasMoveVerb' not in s:
    s = s.replace(old, new)
    print('patched: bare name no longer triggers move')
else:
    print('WARN: mentioned line not found')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 问"某人在哪"：直接给准确位置
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
anchor = "    // 她此刻所在：东家、掌柜、在场名单——压到最后，防止模型凭空造人"
inject = (
    "    // 问\"某人在哪\"：直接给准确位置\n"
    "    try {\n"
    "      const mWhere = String(say || '').match(/([\\u4e00-\\u9fa5]{2,4})\\s*(?:在哪儿|在哪|在何处|何处)/);\n"
    "      if (mWhere) {\n"
    "        const wW2 = loadState(this.dataDir);\n"
    "        const who = String(mWhere[1]);\n"
    "        const hit = Object.values(wW2.actors || {}).find((a) => a && !a.dead && a.name && (a.name === who || a.name.includes(who) || who.includes(a.name)));\n"
    "        if (hit) {\n"
    "          const placeName2 = String(wW2.places?.[hit.location]?.name || '别处');\n"
    "          contextHint += `（【位置】${hit.name}此刻在「${placeName2}」——问他在哪就照这个答，别说不知道。）\\n`;\n"
    "        }\n"
    "      }\n"
    "    } catch {\n"
    "      /* 忽略 */\n"
    "    }\n\n"
)
if anchor in s2 and '【位置】' not in s2:
    s2 = s2.replace(anchor, inject + anchor, 1)
    print('added location answer hint')
else:
    print('WARN: location anchor not found')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
