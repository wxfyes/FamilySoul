import io
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (g.place && g.place !== a.location && hour <= num(g.due)) {"""
new = """    if (a.name === '沈婉儿') console.log(`[Goal] 婉儿推进：place=${g.place} loc=${a.location} hour=${hour} due=${g.due}`);
    if (g.place && g.place !== a.location && hour <= num(g.due)) {"""
if old in s and '婉儿推进' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加推进日志')
