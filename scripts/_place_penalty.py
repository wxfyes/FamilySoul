import io
p = 'src/world/places-target.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  if (hint && p.name && String(p.name).includes(hint)) s += 6;"""
new = """  if (hint && p.name && String(p.name).includes(hint)) s += 6;
  // 别把"衙门"认成"县衙前茶摊"这类带茶/摊/铺的边角地点
  if (/茶|摊|铺|店|集/.test(String(p.name || '')) && !/茶|摊|铺|店|集/.test(hint)) s -= 5;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加边角地点惩罚')
