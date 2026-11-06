import io
# ① 送客后短时间内不许自己回来（日程/摊子都跳过他）
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            if (mv?.ok) names.push(a.name);"""
new = """            if (mv?.ok) {
              // 刚被请走的人，几个时辰内不会再自己溜回来
              a.dismissedUntil = { day: wF.clock?.day || 1, hour: ((Number(wF.clock?.hour) || 0) + 4) % 24 };
              names.push(a.name);
            }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 送客后 4 时辰不许回来')

# ② 摊子不把刚被请走的人拉回街
p2 = 'src/world/stalls.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """  const want = hour >= 7 && hour <= 11 ? 3 : 2;   // 早市热闹些"""
new2 = """  // 刚被主人请走的摊贩，别马上又支起来
  for (const a of Object.values(world?.actors || {})) {
    if (!a?.dismissedUntil) continue;
    const d = a.dismissedUntil;
    if (Number(d.day) === day && Number(d.hour) > hour) continue;
    delete a.dismissedUntil;
  }
  const want = hour >= 7 && hour <= 11 ? 3 : 2;   // 早市热闹些"""
if old2 in t and 'dismissedUntil' not in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 摊子尊重送客冷却')
