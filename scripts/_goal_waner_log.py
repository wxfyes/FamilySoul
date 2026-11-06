import io
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    const g = makeGoal(world, a);
    if (g) { a.goal = { ...g, sinceDay: day }; n += 1; }
    else delete a.goal;"""
new = """    const g = makeGoal(world, a);
    if (g) { a.goal = { ...g, sinceDay: day }; n += 1; }
    else delete a.goal;
    if (a.name === '沈婉儿') console.log(`[Goal] 婉儿：${g ? g.text + ' 去' + g.place : '没生成'}`);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加婉儿日志')
