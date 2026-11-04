import io, re

p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

# 1. 定位交互层块的起止（从注释行到它的最后一个右括号）
start = None
for i, l in enumerate(lines):
    if '交互层：去哪 / 找人 / 约定' in l:
        start = i
        break
if start is None:
    print('WARN: 交互层注释没找到'); raise SystemExit(0)

# 找块结束：从 start 往后，找到与插入块缩进一致的结束标记
# 我们插入的块以 "    // 9.31b" 之前的最后一个 "    }" 结束
end = None
for j in range(start, len(lines)):
    if lines[j].strip() == '// 9.31b 改世界人物属性 POST /api/admin/actor/set {id, age, gender, role, money, name}':
        end = j
        break
if end is None:
    print('WARN: 结束锚点没找到'); raise SystemExit(0)

block = lines[start:end]
# 去掉块尾多余空行
while block and not block[-1].strip():
    block.pop()

# 2. 从原文中移除该块
rest = lines[:start] + lines[end:]

# 3. 找一个"顶层"位置插入：/api/me 路由之前（不在 admin 分支里）
insert_at = None
for i, l in enumerate(rest):
    if "pathname === '/api/me'" in l:
        insert_at = i
        break
if insert_at is None:
    print('WARN: /api/me 锚点没找到'); raise SystemExit(0)

# 缩进不变（4 空格，和顶层 if 一致）
out = rest[:insert_at] + block + [''] + rest[insert_at:]
io.open(p, 'w', encoding='utf-8').write('\n'.join(out))
print(f'已把交互层从 {start+1} 行移到 {insert_at+1} 行（/api/me 之前，顶层）')
