import io
p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "(?:去|往|到|上|回|进)([一-龥]{2,6}?(?:馆|铺|楼|坊|堂|店|院|阁|斋|局|行|庄|园|寺|庵|祠|码头|渡口|桥|街|巷|市|集|仓|监|牢|营|寨))"
new = "(?:去|往|到|上|回|进)([一-龥]{1,6}?(?:馆|铺|楼|坊|堂|店|院|阁|斋|局|行|庄|园|寺|庵|祠|码头|渡口|桥|街|巷|市|集|仓|监|牢|营|寨))"
if old in s:
    s = s.replace(old, new, 1)
    print('fixed place regex')
io.open(p, 'w', encoding='utf-8').write(s)
