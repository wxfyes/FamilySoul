import io, re

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("          const hereB = new Set(")
if start < 0:
    print('WARN: hereB not found')
else:
    end = s.find(");", start)
    end = s.find(");", s.find("flatMap", start))
    # 找到该 new Set(...) 的收尾
    depth = 0
    i = s.find("(", start)
    j = i
    while j < len(s):
        if s[j] == '(':
            depth += 1
        elif s[j] == ')':
            depth -= 1
            if depth == 0:
                break
        j += 1
    body = s[start + len("          const hereB = new Set("):j]
    fixed = (
        "          const hereB = new Set([\n"
        "            '王甯', '相公', '王掌柜', '少掌柜',\n"
        "            ...Object.values(wB.actors || {})\n"
        "              .filter((x) => x && !x.dead && x.location === locB)\n"
        "              .flatMap((x) => [x.name, x.name.length > 2 ? x.name.slice(-2) : x.name]),\n"
        "          ]"
    )
    s = s[:start] + fixed + s[j:]
    print('rewrote hereB')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
