import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace('\n\nexport { dailyIncomeOf };\n', '\n')
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('移除具名导出（函数在日结内部，无法导出）')
