import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const EARNING_STATUS = ['正常营业', '已开张'];
  if (!EARNING_STATUS.includes(String(prop.status || ''))) return 0;"""
new = """  const EARNING_STATUS = ['正常营业', '已开张'];
  if (!EARNING_STATUS.includes(String(prop.status || ''))) {
    prop.incomePerDay = 0;   // 不开门就没有进项，别留着昨天那个数
    return 0;
  }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('不营业的进项清零')
