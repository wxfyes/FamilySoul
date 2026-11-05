import io
# ① 补偿写成数据：现有产业补 openedDay=1（视同第 1 日开张）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "  // 5. 资产账本登记：相公斥资450两全款购置的七进大宅（王宅）"
add = """  // 补偿：测试期之前就开着的产业，一律视同第 1 日开张（写成数据，不靠公式兜底）
  try {
    for (const pr of (world.assets?.properties || [])) {
      if (!pr) continue;
      if (pr.openedDay == null && /正常营业|已开张/.test(String(pr.status || ''))) {
        pr.openedDay = 1;
        console.log(`[Prop] ${pr.name} 视同第 1 日开张（补偿）`);
      }
    }
  } catch { /* 忽略 */ }

""" + anchor
if anchor in s and '[Prop] ${pr.name} 视同第 1 日开张' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 补 openedDay=1')

# ② 删掉 daysOpen 的兜底
p2 = 'src/world/clock.js'
t = io.open(p2, encoding='utf-8-sig').read()
old = """  if (prop.openedDay != null) {
    daysOpen = Math.max(1, curDay - Number(prop.openedDay) + 1);
  } else if (prop.status === '正常营业' || prop.status === '已开张') {
    daysOpen = Math.max(3, curDay);
  }"""
new = """  // 只认账上写的开张日；没写的按"今天开张"算，绝不按世界天数白送
  if (prop.openedDay != null) {
    daysOpen = Math.max(1, curDay - Number(prop.openedDay) + 1);
  }"""
if old in t:
    t = t.replace(old, new, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 删掉白送兜底')
