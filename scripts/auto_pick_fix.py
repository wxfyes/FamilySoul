import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "          if (!namedPresent.length && !partnerHere.length && !String(reply || '').trim()) {"
)
new = (
    "          const presentNamesNow = Object.values(wPost.actors || {})\n"
    "            .filter((a) => a && !a.dead && a.location === locPost && a.id !== this._viewerActorId)\n"
    "            .map((a) => String(a.name || ''))\n"
    "            .filter(Boolean);\n"
    "          const replyHasPresentSpeaker = presentNamesNow.some((n) => String(reply || '').includes(n));\n"
    "          if (!namedPresent.length && !partnerHere.length && !replyHasPresentSpeaker) {"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: auto-pick when reply has no present speaker')
else:
    print('WARN: condition not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
