import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "              reply = `${line}\\n${reply}`;"
new = ("              reply = `${line}\\n${String(reply).split('\\n').filter((x) => !/没人应声/.test(x)).join('\\n')}`\n"
       "                .replace(/\\n{2,}/g, '\\n')\n"
       "                .trim();")
if old in s:
    s = s.replace(old, new)
    print('patched: drop nobody-answered line when proxy speaks')
else:
    print('WARN: proxy prepend line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
