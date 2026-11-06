import io
# ① 铺子到期自动开张 + 日入兜底
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """function dailyIncomeOf(world, prop) {
  // 只有真正开门做生意的才进账：自住府邸、筹建中、歇业一律不进项
  const EARNING_STATUS = ['正常营业', '已开张'];"""
new = """function dailyIncomeOf(world, prop) {
  // 筹备中的铺子：给两天装修期，到期自动开张（不靠谁去点）
  try {
    const day0 = Number(world.clock?.day) || 1;
    const st = String(prop.status || '');
    if (st === '筹备中' || st === '筹建中' || st === '未开张') {
      const since = Number(prop.openedDay ?? prop.createdDay ?? day0);
      if (day0 - since >= 2) {
        prop.status = '已开张';
        prop.openedDay = day0;
        console.log(`[Shop] ${prop.name} 装修期满，自动开张`);
      }
    }
  } catch { /* 忽略 */ }

  // 只有真正开门做生意的才进账：自住府邸、筹建中、歇业一律不进项
  const EARNING_STATUS = ['正常营业', '已开张'];"""
if old in s and '装修期满' not in s:
    s = s.replace(old, new, 1)
    print('① 自动开张')

# ② 日入下限：小铺也要能糊口（按本金与租金估）
old2 = """  const gain = Math.round(capital * rate * 100) / 100;"""
new2 = """  let gain = Math.round(capital * rate * 100) / 100;
  // 一间开着的铺子，日入至少能覆盖"一天的租钱 + 伙计饭钱"
  const rentMonthly = Number(prop.rent || prop.monthlyRent || 0);
  const floor = Math.max(0.15, rentMonthly / 30 * 1.2, staffCount * 0.05);
  if (gain < floor) gain = Math.round(floor * 100) / 100;"""
if old2 in s and '至少能覆盖' not in s:
    s = s.replace(old2, new2, 1)
    print('② 日入下限')
io.open(p, 'w', encoding='utf-8-sig').write(s)
