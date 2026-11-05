import io
p = 'src/world/places-target.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  // 王宅（含七进大宅院/王家大宅这种产业名）一律回丈夫正房或大门，绝不另辟孤岛"""
new = """  // 说的是"人"（去找王甯）：先落到他现在所在的地方，再由门禁决定能不能进
  try {
    const person = Object.values(world?.actors || {}).find(
      (a) => a && !a.dead && a.name && (a.name === text || text.includes(a.name) || a.name.includes(text)),
    );
    if (person && world.places?.[person.location]) return person.location;
  } catch { /* 忽略 */ }

  // 王宅（含七进大宅院/王家大宅这种产业名）一律回丈夫正房或大门，绝不另辟孤岛"""
if old in s and '说的是"人"' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 去"某人"先落其所在')
