import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "。凡谈到价钱，一律照这个数说；绝不许可自报一个更便宜的价来哄相公。）"
new = "。凡谈到价钱，一律照这个数说；绝不许可自报一个更便宜的价来哄相公。**此前若有人说过别的米价（比如四钱一石），那是记错了，当场改口，以这条为准。**）"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 行情事实加上"改口"指令')
