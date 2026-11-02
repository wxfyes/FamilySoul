import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 判词里允许"下狱"
old = "        '只输出 JSON：{\"verdict\":\"guilty|false\",\"reason\":\"一句话判词(20字内)\",\"penalty\":{\"silver\":0,\"wanted\":0,\"rep\":0}}',"
new = (
    "        c.petty ? `这是一桩民间小案（${c.claim}）。` : '',\n"
    "        '只输出 JSON：{\"verdict\":\"guilty|false\",\"reason\":\"一句话判词(20字内)\",\"penalty\":{\"silver\":0,\"wanted\":0,\"rep\":0,\"jail\":0}}',\n"
    "        'jail = 下狱天数（小案 3~10 天，重案可 30 天）。',"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: jail in verdict')

# ② 判 guilty：下狱（男女分监）+ 罚银
old2 = (
    "        if (Number(pen.wanted) > 0) w3.flags.wanted = (Number(w3.flags.wanted) || 0) + Number(pen.wanted);"
)
new2 = (
    "        if (Number(pen.wanted) > 0) w3.flags.wanted = (Number(w3.flags.wanted) || 0) + Number(pen.wanted);\n"
    "        const jailDays = Math.max(0, Math.min(60, Number(pen.jail) || 0));\n"
    "        const culprit = w3.actors?.[cc.againstId];\n"
    "        if (jailDays > 0 && culprit && culprit.id !== 'husband') {\n"
    "          culprit.jailed = { untilDay: (Number(w3.clock?.day) || 1) + jailDays, caseId: cc.id };\n"
    "          culprit.location = culprit.gender === 'male' ? 'jail_male' : 'jail_female';\n"
    "        }"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: apply jail')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
