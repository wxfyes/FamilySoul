import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# 仅审 'hearing' 状态的案子，并要求双方到场（真人除外）
s = s.replace(
    "      const c = (w.cases || []).find((x) => x && x.status === 'filed');",
    "      const c = (w.cases || []).find((x) => x && x.status === 'hearing');",
)

# 判词前加"堂上问答"，让判决有审讯感
old = "        `现场人证：${(c.witnesses || []).join('、') || '无'}。`,"
new = (
    "        `现场人证：${(c.witnesses || []).join('、') || '无'}。`,\n"
    "        '先写堂上情形：原告怎么陈词、被告怎么辩、人证怎么说（各一句，共 2~3 句）。',\n"
    "        '再写判词。',"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: interrogation lines')

# 判决存下审讯摘要，并允许玩家在旁边听
s = s.replace(
    "      cc.status = 'judged';",
    "      cc.status = 'judged';\n"
    "      cc.hearing = String(d.hearing || '').slice(0, 160);",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
