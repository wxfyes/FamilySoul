import io

# ① 代演提示：他就是掌柜本人
p = 'src/world/proxy-actor.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "    '1. 只写他自己说的话，一到两句，符合他的身份与此刻的处境；',"
new = (
    "    '1. 你就是他本人。别人问「王掌柜在不在」「掌柜呢」，问的就是你——不许说「王掌柜不在」，也不许把自己当旁人；',\n"
    "    '2. 只写他自己说的话，一到两句，符合他的身份与此刻的处境；',"
)
if old in s:
    s = s.replace(old, new)
    print('patched proxy self-identity')
io.open(p, 'w', encoding='utf-8').write(s)

# 调整后面两条编号
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("    '2. 不要旁白、不要解释、不要写别人的台词、不要在开头写他的名字；',", "    '3. 不要旁白、不要解释、不要写别人的台词、不要在开头写他的名字；',")
s = s.replace("    '3. 他不知道的事不许假装知道；不确定就照实说不知道。',", "    '4. 他不知道的事不许假装知道；不确定就照实说不知道。',")
io.open(p, 'w', encoding='utf-8').write(s)

# ② 触发条件放宽：上一句提到过王甯 / 用户在追问"你是谁"
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old2 = "        if (husHere && /(王甯|王掌柜|少掌柜|相公)/.test(String(say || '')) && !/【[^】]*王甯/.test(String(reply))) {"
new2 = (
    "        const lastTurns = [...(this.readHistory(profileKey).messages || [])].slice(-3).map((m) => String(m?.text || '')).join(' ');\n"
    "        const askedHim = /(王甯|王掌柜|少掌柜|相公)/.test(String(say || ''))\n"
    "          || /(王甯|王掌柜|少掌柜)/.test(lastTurns)\n"
    "          || /(那你|你是谁|谁啊|在吗)/.test(String(say || ''));\n"
    "        if (husHere && askedHim && !/【[^】]*王甯/.test(String(reply))) {"
)
if old2 in s2:
    s2 = s2.replace(old2, new2)
    print('patched proxy trigger')
else:
    print('WARN: trigger line not found')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
