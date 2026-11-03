import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "            reply = wrapProxyLine(speaker, rewritten) || rewritten;"
new = "            reply = /^【[^】]+】/.test(rewritten) ? rewritten : (wrapProxyLine(speaker, rewritten) || rewritten);"
if old in s:
    s = s.replace(old, new, 1)
    print('patched: avoid double speaker prefix')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
