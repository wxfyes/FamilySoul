import io
mil = io.open('docs/military-marriage-power.md', encoding='utf-8').read()
fin = io.open('docs/finance-system.md', encoding='utf-8').read()

# 金融部分去掉自己的 H1 与开头引言，作为第二部分接入
lines = fin.split('\n')
idx = 0
for i, l in enumerate(lines):
    if l.startswith('## 0. 货币与计价'):
        idx = i
        break
fin_body = '\n'.join(lines[idx:])

head = mil.replace(
    '# 军法 · 联姻 · 党争 —— 系统规格',
    '# 权力与钱 —— 军法 · 联姻 · 党争 · 钱庄 · 牙行 · 盐 · 码头 · 粮（系统规格）',
    1,
)

merged = head.rstrip() + '\n\n---\n\n# 第二部分 · 金融与商路\n\n' + fin_body
io.open('docs/military-marriage-power.md', 'w', encoding='utf-8').write(merged)
print('merged lines:', len(merged.split('\n')))
