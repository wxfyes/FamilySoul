import io
# ① 粮价回到"秋后新谷"的现实：一石 0.4 两（明末江南丰年），不再 0.6
p = 'src/world/prices.js'
s = io.open(p, encoding='utf-8-sig').read()
import re
m = re.search(r"grain:\s*\{[^}]*\}", s)
print('原:', m.group(0) if m else '未找到')
if m and 'base: 0.6' in m.group(0):
    s = s.replace(m.group(0), m.group(0).replace('base: 0.6', 'base: 0.4'))
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 粮价 0.6 → 0.4 两/石')

# ② 去掉"当场改口"这种元指令，改为朴素的"以今日行情为准"
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
old = "**此前若有人说过别的米价（比如四钱一石），那是记错了，当场改口，以这条为准。**）"
new = "此前若说过别的价，以这条为准。）"
if old in t:
    t = t.replace(old, new, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 去掉元指令')
