import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "          kinds: f.kinds || {},"
new = "          kinds: (f.kinds && Object.keys(f.kinds).length) ? f.kinds : {},   // 空则由下面真人数据反推"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('kinds 注释')
