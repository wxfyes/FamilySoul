import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        if (/没人应声|没人接话/.test(String(reply))) {\n"
    "          const placeNow = String(wPost.places?.[locPost]?.name || '');\n"
    "          if (movedNow && placeNow) reply = `【${placeNow}】：（你到了${placeNow}。）`;\n"
    "          else reply = `【${placeNow || '这里'}】：（没人接话。）`;\n"
    "        }"
)
new = (
    "        if (/没人应声|没人接话/.test(String(reply))) {\n"
    "          const placeNow = String(wPost.places?.[locPost]?.name || '');\n"
    "          // 别写\"没人接话\"：照实说这里有谁、在忙什么\n"
    "          const here = Object.values(wPost.actors || {})\n"
    "            .filter((a) => a && !a.dead && a.location === locPost && a.id !== this._viewerActorId && a.id !== 'husband')\n"
    "            .slice(0, 4);\n"
    "          const hereText = here.length\n"
    "            ? here.map((a) => `${a.name}${a.activity?.text ? '正' + a.activity.text : ''}`).join('，')\n"
    "            : '';\n"
    "          const lead = movedNow ? `你到了${placeNow}` : `就是${placeNow}`;\n"
    "          reply = hereText\n"
    "            ? `【${placeNow || '这里'}】：${lead}——${hereText}。`\n"
    "            : `【${placeNow || '这里'}】：${lead}，四下冷清，没什么人。`;\n"
    "        }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: scene narration lists who is here')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
