import io

p = 'src/world/member-reply.js'
s = io.open(p, encoding='utf-8-sig').read()

# 旁白不能叫"旁白"：客户端把"旁白"当泛称归给主角，会显示成她自己
s = s.replace(
    "      kept.push({ speaker: '旁白', text: body });",
    "      kept.push({ speaker: placeLabel, text: body });",
)
s = s.replace(
    "  const present = new Set((ctx?.present || []).filter(Boolean));",
    "  const present = new Set((ctx?.present || []).filter(Boolean));\n"
    "  const placeLabel = String(ctx?.placeName || '这里');",
)
s = s.replace(
    "  if (kept.length === 0) {\n"
    "    if (ctx?.husbandPlace) {\n"
    "      return `【旁白】：他此刻在「${ctx.husbandPlace}」，眼下不在这间屋里。`;\n"
    "    }\n"
    "    return '【旁白】：（没人应声。）';\n"
    "  }",
    "  if (kept.length === 0) {\n"
    "    if (ctx?.askedHusband && ctx?.husbandPlace) {\n"
    "      return `【${placeLabel}】：他此刻在「${ctx.husbandPlace}」，眼下不在这屋里。`;\n"
    "    }\n"
    "    return `【${placeLabel}】：（屋里一时没人应声。）`;\n"
    "  }",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('patched member-reply')

p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
s2 = s2.replace(
    "          husbandPlace: husHere ? null : String(wPost.places?.[husPost?.location]?.name || '别处'),",
    "          husbandPlace: husHere ? null : String(wPost.places?.[husPost?.location]?.name || '别处'),\n"
    "          placeName: String(wPost.places?.[locPost]?.name || '这里'),\n"
    "          askedHusband: /(王甯|王掌柜|少掌柜|相公)/.test(String(say || '')),",
)
io.open(p2, 'w', encoding='utf-8').write(s2)
print('patched pet-service call')
