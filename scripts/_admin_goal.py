import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "            duty: a.duty || null,\n            home: a.home || null,"
new = "            duty: a.duty || null,\n            home: a.home || null,\n            goal: a.goal || null,\n            lastGoal: a.lastGoal || null,\n            awayUntil: a.awayUntil || null,"
if old in s and 'goal: a.goal' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('admin 暴露 goal/awayUntil')
