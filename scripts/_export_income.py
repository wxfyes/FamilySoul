import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function dailyIncomeOf' not in s:
    s = s.replace('function dailyIncomeOf(world, prop) {', 'export function dailyIncomeOf(world, prop) {', 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('导出 dailyIncomeOf（便于算账验证）')
