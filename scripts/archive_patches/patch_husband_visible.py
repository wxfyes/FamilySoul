import io

# ① 提示词：明确"王甯由你演，玩家是紫嫣"
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      lines.push('玩家点名要找在场的人时，**那个人必须自己开口应声**，不许让伙计挡驾、不许说他在忙。');"
add = "      lines.push('玩家是这个人本人，**王甯不是玩家，他由你来演**；他在这屋里，就得他开口说话。');"
if anchor in s and '王甯不是玩家' not in s:
    s = s.replace(anchor, anchor + "\n" + add, 1)
    print('patched: 王甯 is yours to play')
else:
    print('WARN: anchor not found or already patched')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 规范化：他在场却被漏掉时，用旁白点明他在
p2 = 'src/world/member-reply.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old = "  if (kept.length === 0) {"
new = (
    "  // 他明明在场、玩家又点名找他，模型却没写他 → 至少用旁白点明他在\n"
    "  if (ctx?.husbandPresent && ctx?.askedHusband) {\n"
    "    const spoken = kept.some((x) => /王甯|相公|王掌柜|少掌柜/.test(String(x.speaker || '')));\n"
    "    if (!spoken) kept.push({ speaker: placeLabel, text: '（王甯就在这屋里，只是没急着开口。）' });\n"
    "  }\n\n"
    "  if (kept.length === 0) {"
)
if old in s2 and '王甯就在这屋里' not in s2:
    s2 = s2.replace(old, new, 1)
    print('patched: husband-in-room narration')
else:
    print('WARN: normalize anchor not found')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
