import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          if (names.length) {"""
new = """          if (names.length) {
            try {
              wF.flags = wF.flags || {};
              wF.flags.stallQuietUntil = { day: wF.clock?.day || 1, hour: ((Number(wF.clock?.hour) || 0) + 3) % 24 };
            } catch { /* 忽略 */ }"""
if old in s and 'stallQuietUntil' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 送客后摊子静三个时辰')

p2 = 'src/world/stalls.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """  const want = hour >= 7 && hour <= 11 ? 3 : 2;   // 早市热闹些"""
new2 = """  // 刚清过场，摊子别立刻又冒出来
  const quiet = world?.flags?.stallQuietUntil;
  if (quiet && Number(quiet.day) === day) {
    const qh = Number(quiet.hour) || 0;
    if (qh > hour || qh < 6 && hour >= 6 && hour < qh) return 0;
    delete world.flags.stallQuietUntil;
  }
  const want = hour >= 7 && hour <= 11 ? 3 : 2;   // 早市热闹些"""
if old2 in t and 'stallQuietUntil' not in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 摊子尊重清场静默')
