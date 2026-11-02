import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "          if (presentNames.has(who)) return true;\n"
    "          if (/(天道|旁白|众人)/.test(who)) return true;"
)
new = (
    "          if (presentNames.has(who)) return true;\n"
    "          // 王甯在别处也能捎话，不许掐；其余不在场的照掐\n"
    "          if (/(王甯|王掌柜)/.test(who)) return true;\n"
    "          if (/(天道|旁白|众人)/.test(who)) return true;"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: keep husband lines when apart')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
