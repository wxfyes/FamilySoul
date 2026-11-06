import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'advanceWorldTick' not in s:
    s = s.replace("import { roomForHour } from './room-life.js';",
                  "import { roomForHour } from './room-life.js';\nimport { advanceWorldTick } from './tick.js';", 1)
    old = """  // 每小时：私宅巡检——不是这宅子的人，待久了或入夜就请出去"""
    new = """  // 每小时：世界自己往前推一格（米价、民心、债），只动事实不动台词
  try {
    const tick = advanceWorldTick(world, world.clock.hour);
    if (tick && tick.note && tick.note !== '无事') console.log(`[Tick] ${world.clock.day}日${world.clock.hour}时：${tick.note}`);
  } catch (err) {
    console.warn('[Tick] 推进失败：', err.message);
  }

  // 每小时：私宅巡检——不是这宅子的人，待久了或入夜就请出去"""
    if old in s:
        s = s.replace(old, new, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('① clock 接 World Tick')
    else:
        print('未找到挂载点')
else:
    print('已接')
