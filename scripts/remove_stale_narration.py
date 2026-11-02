import io

p = 'src/world/member-reply.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  // 他明明在场、玩家又点名找他，模型却没写他 → 至少用旁白点明他在\n"
    "  if (ctx?.husbandPresent && ctx?.askedHusband) {\n"
    "    const spoken = kept.some((x) => /王甯|相公|王掌柜|少掌柜/.test(String(x.speaker || '')));\n"
    "    if (!spoken) kept.push({ speaker: placeLabel, text: '（王甯就在这屋里，只是没急着开口。）' });\n"
    "  }\n\n"
)
if old in s:
    s = s.replace(old, '')
    print('removed stale narration (proxy now handles it)')
else:
    print('WARN: narration block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
