import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace('export function dailyIncomeOf(world, prop) {', 'function dailyIncomeOf(world, prop) {', 1)
if 'export { dailyIncomeOf }' not in s:
    s = s.rstrip() + '\n\nexport { dailyIncomeOf };\n'
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('改成文件末尾具名导出')
