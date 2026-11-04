import io
p = 'web/dashboard.html'
lines = io.open(p, encoding='utf-8').read().split('\n')

# 找到线索卡的起止（1-based 1017..1020 → index 1016..1019）
s_i = next(i for i, l in enumerate(lines) if '查探线索' in l) - 1
e_i = next(i for i in range(s_i, len(lines)) if lines[i].strip() == '</section>')
block = lines[s_i:e_i + 1]
assert 'clues' in '\n'.join(block)
del lines[s_i:e_i + 1]
print('搬走线索卡:', s_i + 1, '→', e_i + 1)

# 总览页里找"最近世界事件/趋势"那一排结束，插在它后面
anchor = next(i for i, l in enumerate(lines) if '大事记时间线' in l)
# 从 anchor 往下找该 grid 的结束
depth = 0
end = None
for i in range(anchor, len(lines)):
    depth += lines[i].count('<div')
    depth -= lines[i].count('</div>')
    if depth <= 0 and '</div>' in lines[i] and i > anchor + 2:
        end = i
        break
newblock = ['        <section class="card full">'] + [l for l in block][1:-1] + ['        </section>']
lines = lines[:end] + [''] + newblock + lines[end:]
io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('已放入总览页，插入点:', end + 1)
