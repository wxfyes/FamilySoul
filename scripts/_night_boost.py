import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  let gain = Math.round(capital * rate * 100) / 100;"""
new = """  // 夜市加成：这几天多进项
  try {
    if (prop.nightBoost && (Number(world.clock?.day) || 1) <= Number(prop.nightBoost.untilDay)) {
      rate *= 1 + (Number(prop.nightBoost.rate) || 0.3);
    }
  } catch { /* 忽略 */ }

  let gain = Math.round(capital * rate * 100) / 100;"""
if old in s and '夜市加成' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('夜市加成')
