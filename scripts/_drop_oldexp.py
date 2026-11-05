import io
p = 'src/world/clock.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
# 删掉第 920 行（旧赋值）
idx = 919
if 'tr.lastExpense = expense;' in lines[idx]:
    del lines[idx]
    io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
    print('删掉旧的 lastExpense 赋值')
else:
    print('位置不对，实际是:', lines[idx].strip())
