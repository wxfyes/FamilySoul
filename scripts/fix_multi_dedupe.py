import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "          const already = new RegExp(`【[^】]*${String(who.name).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`).test(String(reply || ''));"
)
new = (
    "          const shortN = String(who.name).length > 2 ? String(who.name).slice(-2) : String(who.name);\n"
    "          const already = new RegExp(`【[^】]*(?:${String(who.name)}|${shortN})`).test(String(reply || ''));"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: short-name dedupe')
else:
    print('WARN: already regex not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
