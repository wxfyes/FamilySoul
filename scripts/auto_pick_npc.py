import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "          for (const npc of (namedPresent.length ? namedPresent : partnerHere).slice(0, 2)) {"
)
new = (
    "          // 没人被点名、也没有对话对象，且回复已空 → 让在场最亲近的人开口\n"
    "          let autoPick = [];\n"
    "          if (!namedPresent.length && !partnerHere.length && !String(reply || '').trim()) {\n"
    "            const here2 = Object.values(wPost.actors || {})\n"
    "              .filter((a) => a && !a.dead && a.location === locPost && a.id !== this._viewerActorId && a.id !== 'husband')\n"
    "              .sort((x, y) => (Number(y.relations?.husband?.trust) || 0) - (Number(x.relations?.husband?.trust) || 0));\n"
    "            autoPick = here2.slice(0, 1);\n"
    "          }\n"
    "          for (const npc of (namedPresent.length ? namedPresent : (partnerHere.length ? partnerHere : autoPick)).slice(0, 2)) {"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: auto-pick present npc when reply empty')
else:
    print('WARN: npc loop not found')

# 旁白只在真的没人时出现，且别每次都念同一串
old2 = (
    "          const hereText = hereNow.map((a) => `${a.name}${a.activity?.text ? '正' + a.activity.text : ''}`).join('，');"
)
new2 = (
    "          const hereText = hereNow.slice(0, 2).map((a) => `${a.name}${a.activity?.text ? '正' + a.activity.text : ''}`).join('，');"
)
if old2 in s:
    s = s.replace(old2, new2, 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
