import io, re, shutil, sys

p = 'web/dashboard.html'
shutil.copy(p, p + '.bak-before-reorder')
lines = io.open(p, encoding='utf-8').read().split('\n')

# 1. 找出所有卡片区块（<section class="card ..."> ... </section>）
start_idx = [i for i, l in enumerate(lines) if re.match(r'\s*<section class="card', l)]
if not start_idx:
    print('no sections found'); sys.exit(1)

blocks = []
for si, s in enumerate(start_idx):
    e = None
    for j in range(s, min(s + 400, len(lines))):
        if lines[j].strip() == '</section>':
            e = j
            break
    if e is None:
        print(f'WARN: section at line {s+1} 未找到闭合'); sys.exit(1)
    title = ''
    if 'morning-banner' in lines[s]:
        title = '__BANNER__'
    for j in range(s, min(s + 6, e)):
        m = re.search(r'<h2>(.*?)</h2>', lines[j])
        if m:
            title = re.sub(r'<[^>]+>', '', m.group(1)).strip()
            break
    blocks.append({'start': s, 'end': e, 'title': title, 'lines': lines[s:e + 1]})

# 2. 期望顺序（按标题关键字的优先序）
ORDER = [
    '家宅', '账目', '朝堂', '军中',
    '城中动静', '案子', '街面风评', '关系网', '大事记', '各自的主线', '待办', '线索',
    '朝中', '天下（行会', '势力与兵力', '天下（城池', '山川', '基础设施', '产业表',
    '人物', '天机', '她们亲口说过的话', '最近事件', '趋势', '盘点',
    '运行状态', '花费', '体检结果', '成员绑定', '真人',
    '家底', '清空记忆',
]

def rank(title):
    if title == '__BANNER__':
        return -1
    for i, k in enumerate(ORDER):
        if k in title:
            return i
    return len(ORDER) + 1

ordered = sorted(blocks, key=lambda b: (rank(b['title']), b['start']))

# 3. 家底与账目重复 → 隐藏（保留 DOM，避免前端 JS 找不到元素）
for b in ordered:
    if '家底' in b['title'] and 'id="card-household"' not in b['lines'][0]:
        b['lines'][0] = b['lines'][0].replace('<section class="card"',
                                              '<section class="card" data-dup="1" style="display:none"', 1)

# 4. 重组：第一个区块之前的所有内容 + 新顺序 + 最后一个区块之后的内容
head = lines[:blocks[0]['start']]
tail = lines[blocks[-1]['end'] + 1:]

out = head[:]
for b in ordered:
    out.extend(b['lines'])
    out.append('')          # 卡片之间留空行
out.extend(tail)

io.open(p, 'w', encoding='utf-8').write('\n'.join(out))

print('重排完成，卡片数:', len(ordered))
for i, b in enumerate(ordered, 1):
    print('  %2d. %s' % (i, b['title'][:28]))
