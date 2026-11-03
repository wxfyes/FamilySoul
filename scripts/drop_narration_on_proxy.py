import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "              reply = `${npLine}\\n${String(reply).split('\\n').filter((x) => !/没人应声|没人接话/.test(x)).join('\\n')}`.trim();"
new = "              reply = `${npLine}\\n${String(reply).split('\\n').filter((x) => !/没人应声|没人接话|就站在|四下冷清|你到了/.test(x)).join('\\n')}`.trim();"
if old in s:
    s = s.replace(old, new, 1)
    print('patched: drop narration when proxy speaks')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
