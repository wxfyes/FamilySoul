import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "      lines.push('【再说一遍】' + own.split('\\n').slice(0, 4).join('；'));"
new = (
    "      lines.push('【再说一遍】'"
    " + own.split('\\n').slice(0, 3).map((x) => x.replace(/。$/, '')).join(' ｜ ')"
    " + '。');"
)
if old in s:
    s = s.replace(old, new)
    print('fixed reinforcement formatting')
else:
    print('WARN: reinforcement line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
