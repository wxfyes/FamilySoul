import io
p = 'web/dashboard.html'
lines = io.open(p, encoding='utf-8').read().split('\n')

# 1-based: 1006..1019 是要搬走的块（timeline 卡 + events/trend 两列）
start = 1005 - 1
end = 1019 - 1
block = lines[start:end + 1]
assert '大事记时间线' in '\n'.join(block), '定位失败'
del lines[start:end + 1]

# 插到总览 tab 结束前：找 tab-overview 的结束 '</div>'（原 799 行附近）
idx = next(i for i, l in enumerate(lines) if 'id="tab-overview"' in l)
close = None
depth = 0
for i in range(idx, len(lines)):
    if '<div' in lines[i]:
        depth += lines[i].count('<div')
    if '</div>' in lines[i]:
        depth -= lines[i].count('</div>')
    if depth <= 0 and i > idx:
        close = i
        break
print('overview 结束行:', close + 1)
ins = close  # 插在结束 div 之前
lines = lines[:ins] + [''] + block + lines[ins:]
io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('已搬入总览页')
