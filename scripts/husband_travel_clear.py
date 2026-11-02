import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "      if (summonResult?.wentTo && summonResult.moved?.length) {\n"
    "        contextHintEarly += `（【已到场】：相公已经走到${summonResult.wentTo}了。本轮以新地点为主场，由这里的人开口；刚才那处的人最多送到门口说一句，不能继续占着戏。）\\n`;\n"
    "      }"
)
new = (
    "      if (summonResult?.wentTo && summonResult.moved?.length) {\n"
    "        contextHintEarly += `（【已到场】：相公已经走到${summonResult.wentTo}了。本轮以新地点为主场，由这里的人开口；刚才那处的人最多送到门口说一句，不能继续占着戏。）\\n`;\n"
    "        // 换了城：旧对话对象作废（她不在苏州）\n"
    "        try {\n"
    "          const wt2 = loadState(this.dataDir);\n"
    "          wt2.chatPartners = {};\n"
    "          saveState(this.dataDir, wt2);\n"
    "        } catch { /* 忽略 */ }\n"
    "      }"
)
if old in s and '旧对话对象作废（她不在' not in s:
    s = s.replace(old, new, 1)
    print('patched: clear partners on husband travel')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
