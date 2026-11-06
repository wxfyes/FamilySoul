import io
# 铺子的日入下限按"行当+租钱"定：小店一年要能挣出十倍租钱才有人干
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const rentMonthly = Number(prop.rent || prop.monthlyRent || 0);
  const floor = Math.max(0.15, rentMonthly / 30 * 1.2, staffCount * 0.05);"""
new = """  const rentYearly = Number(prop.rentYearly || prop.rentAnnual || 0);
  const rentMonthly = Number(prop.rent || prop.monthlyRent || 0);
  // 小店：一年要挣出十倍租钱才有人干（50 两租 → 日入约 1.5 两）
  const shopFloor = /铺|店|号|栈|坊/.test(String(prop.name || '')) && !/酒楼|茶坊|茶栈|货栈/.test(String(prop.name || ''))
    ? (rentYearly > 0 ? rentYearly / 365 * 10 : 1.5)
    : 0.15;
  const floor = Math.max(shopFloor, rentMonthly / 30 * 1.2, staffCount * 0.05);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('铺子日入下限到 1.5 两')
