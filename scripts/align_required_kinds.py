import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "      const REQUIRED = ['青楼', '赌坊', '客栈', '当铺', '药铺', '米行', '酒楼', '铁铺', '布庄', '香烛', '糕点', '茶馆'];"
new = "      const REQUIRED = ['青楼', '赌坊', '客栈', '当铺', '药铺', '米铺', '铁匠铺', '衣铺', '糖铺', '面摊', '肉铺', '香烛', '糕点', '茶馆'];"
if old in s:
    s = s.replace(old, new)
    print('aligned required kinds with seeded names')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
