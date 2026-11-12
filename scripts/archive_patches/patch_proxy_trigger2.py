import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        const askedHim = /(王甯|王掌柜|少掌柜|相公)/.test(String(say || ''))\n"
    "          || /(王甯|王掌柜|少掌柜)/.test(lastTurns)\n"
    "          || /(那你|你是谁|谁啊|在吗)/.test(String(say || ''));"
)
new = (
    "        const askedHim = /(王甯|王掌柜|少掌柜|相公)/.test(String(say || ''))\n"
    "          || /(王甯|王掌柜|少掌柜)/.test(lastTurns)\n"
    "          || /(你|您)/.test(String(say || ''))\n"
    "          || /(那你|你是谁|谁啊|在吗)/.test(String(say || ''));"
)
if old in s:
    s = s.replace(old, new)
    print('patched: any second-person address triggers proxy')
else:
    print('WARN: askedHim block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
