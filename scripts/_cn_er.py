import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace('\\u4e00\\u4e24\\u4e09\\u56db\\u4e94\\u516d\\u4e03\\u516b\\u4e5d', '\\u4e00\\u4e8c\\u4e24\\u4e09\\u56db\\u4e94\\u516d\\u4e03\\u516b\\u4e5d')
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('补 二')
