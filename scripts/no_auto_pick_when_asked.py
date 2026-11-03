import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "          if (!namedPresent.length && !partnerHere.length && !replyHasPresentSpeaker) {"
new = (
    "          // 问的是某个具体的人（可能不在场）→ 不许路人乱插话\n"
    "          const askedAnyActor = Object.values(wPost.actors || {}).some((a) => {\n"
    "            if (!a || !a.name) return false;\n"
    "            const short = a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
    "            return String(say || '').includes(a.name) || (short && String(say || '').includes(short));\n"
    "          });\n"
    "          if (!askedAnyActor && !namedPresent.length && !partnerHere.length && !replyHasPresentSpeaker) {"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: no auto-pick when asking about someone')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
