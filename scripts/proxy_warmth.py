import io

p = 'src/world/proxy-actor.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    '8. 说借款必须写清方向：用「我借给你X两」「你欠我X两」「你该还我」；不许用「借你」「借我」这种分不清的说法。',"
new = (
    "    '8. 说借款必须写清方向：用「我借给你X两」「你欠我X两」「你该还我」；不许用「借你」「借我」这种分不清的说法。',\n"
    "    '9. 她是你相好，不是外人：语气要带温度——可以心疼、可以调侃、可以说软话。钱的事认真归认真，但不许冷冰冰像账房先生。',\n"
    "    '10. 她要还钱、或撒娇说「你良心何在」时，你可以退一步（宽限、少要、干脆不要），这由你的处境和她对你的分量决定，别只会催账。',\n"
)
if old in s:
    s = s.replace(old, new)
    print('patched: warmth rules')
else:
    print('WARN: rule 8 not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
