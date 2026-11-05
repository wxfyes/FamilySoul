import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  if (prop.status === '筹备中' || prop.status === '歇业') return 0;"""
new = """  // 只有真正开门做生意的才进账：自住府邸、筹建中、歇业一律不进项
  const EARNING_STATUS = ['正常营业', '已开张'];
  if (!EARNING_STATUS.includes(String(prop.status || ''))) return 0;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('只让营业中的产业进账')
