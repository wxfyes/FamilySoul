import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "            '王甯', '相公', '王掌柜', '少掌柜',"
new = ("            ...(Object.values(wB.actors || {}).find((x) => x && x.id === 'husband' && x.location === locB)\n"
       "              ? ['王甯', '相公', '王掌柜', '少掌柜']\n"
       "              : []),")
if old in s:
    s = s.replace(old, new)
    print('patched: 王甯 only speakable when actually present')
else:
    print('WARN: alias line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
