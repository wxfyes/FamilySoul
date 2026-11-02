import io

p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

start = None
for i, line in enumerate(lines):
    if "if (/没人应声/.test(String(reply))) {" in line:
        start = i
        break
if start is None:
    print('WARN: fallback block not found')
else:
    end = None
    for j in range(start, start + 8):
        if lines[j].strip() == '}':
            end = j
            break
    if end is None:
        print('WARN: block end not found')
    else:
        new_block = [
            "        // 空场别写\"没人接话\"：照实说这里有谁、在忙什么",
            "        if (/没人应声|没人接话/.test(String(reply))) {",
            "          const placeNow = String(wPost.places?.[locPost]?.name || '');",
            "          const hereNow = Object.values(wPost.actors || {})",
            "            .filter((a) => a && !a.dead && a.location === locPost && a.id !== this._viewerActorId && a.id !== 'husband')",
            "            .slice(0, 4);",
            "          const hereText = hereNow.map((a) => `${a.name}${a.activity?.text ? '正' + a.activity.text : ''}`).join('，');",
            "          const lead = movedNow ? `你到了${placeNow}` : `就站在${placeNow}`;",
            "          reply = hereText",
            "            ? `【${placeNow || '这里'}】：${lead}——${hereText}。`",
            "            : `【${placeNow || '这里'}】：${lead}，四下冷清，没什么人。`;",
            "        }",
        ]
        lines = lines[:start] + new_block + lines[end + 1:]
        print('replaced empty-scene fallback with factual narration')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('ok')
