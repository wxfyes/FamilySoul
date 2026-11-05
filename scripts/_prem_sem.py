import io
# ② places-target：补经营空间的语义词（大堂/雅阁/天字/地窖/后厨）
p = 'src/world/places-target.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  { key: '酒楼', test: /酒楼|酒肆|饭庄/ },"""
new = """  { key: '地窖', test: /酒窖|地窖|窖/ },
  { key: '天字阁', test: /天字|三楼|三层|雅阁/ },
  { key: '后厨', test: /后厨|厨房|砧板/ },
  { key: '大堂', test: /大堂|散座|柜台|前店/ },
  { key: '酒楼', test: /酒楼|酒肆|饭庄/ },"""
if '天字阁' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('② 经营空间语义')
