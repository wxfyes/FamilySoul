import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "          const replyHasPresentSpeaker = presentNamesNow.some((n) => String(reply || '').includes(n));\n"
    "          if (!namedPresent.length && !partnerHere.length && !replyHasPresentSpeaker) {"
)
new = (
    "          const replyIsNarration = /(就站在|四下冷清|你到了|没人接话|没人应声)/.test(String(reply || ''));\n"
    "          const replyHasPresentSpeaker = !replyIsNarration && presentNamesNow.some((n) => String(reply || '').includes(n));\n"
    "          if (!namedPresent.length && !partnerHere.length && !replyHasPresentSpeaker) {"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: narration counts as empty')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
