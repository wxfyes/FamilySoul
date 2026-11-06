import io
# ① 送客去处：同院不算走，改回她自己的住处
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          if (!dest) dest = who.quarters || who.home || null;"""
new = """          // 目的地跟现在同一处院落（只是同一栋楼里换个房间），那不算"走"
          const curRoot = String(wG.places?.[who.location]?.parent || who.location);
          const destRoot = dest ? String(wG.places?.[dest]?.parent || dest) : '';
          if (dest && (dest === who.location || destRoot === curRoot)) dest = null;
          if (!dest) dest = who.quarters || who.home || null;"""
if old in s and '同院不算走' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 同院不算走')

# ② P3：世界日报数据（今日 tick 记录 + 有打算的人）
p2 = 'src/world/tick.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """  return { grain: grainMoved, cities: citiesMoved, note: note || '无事' };"""
new2 = """  // 记进当日流水，供"世界日报"读
  try {
    world.flags.tickLog = Array.isArray(world.flags.tickLog) ? world.flags.tickLog : [];
    if (note) {
      world.flags.tickLog.push({ day, hour: h, note, at: Date.now() });
      if (world.flags.tickLog.length > 48) world.flags.tickLog = world.flags.tickLog.slice(-48);
    }
  } catch { /* 忽略 */ }

  return { grain: grainMoved, cities: citiesMoved, note: note || '无事' };"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② tick 留当日流水')
