import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "        contextHint += `（【府中人】${line}"
idx = s.find(anchor)
if idx < 0:
    print('WARN: roster line not found')
else:
    end = s.find('\n', idx)
    s = s[:end + 1] + "        console.log(`[Bonds] 府中人 ${house.length}：${line.slice(0, 40)}`);\n" + s[end + 1:]
    print('added roster log')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
