import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("/酒楼|茶坊|茶栈|客栈|衙署|县衙|码头/", "/酒楼|酒肆|饭庄|茶坊|茶肆|茶楼|茶栈|客栈|衙署|县衙|码头|货栈|商行/")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('公开场所匹配补上 酒肆/饭庄/茶肆/茶楼/货栈/商行')
