import io, re
p = 'mobile/lib/views/chat_screen.dart'
lines = io.open(p, encoding='utf-8').read().split('\n')

targets = ["出门 · 找人 · 赴约", "出门·找人·赴约", "家兵", "记一笔花销", "今日看板", "我的世界"]

def find_title_idx(t):
    for i, l in enumerate(lines):
        if 'title:' in l and f"'{t}'" in l:
            return i
    return -1

removed = 0
for t in targets:
    for _ in range(3):
        i = find_title_idx(t)
        if i < 0:
            break
        # 往上找 ListTile(
        s = i
        while s > 0 and 'ListTile(' not in lines[s]:
            s -= 1
        # 往下找与 ListTile 同缩进的 ),
        indent = len(lines[s]) - len(lines[s].lstrip())
        e = i
        while e < len(lines) - 1:
            if lines[e].strip() == '),' and (len(lines[e]) - len(lines[e].lstrip())) == indent:
                break
            e += 1
        del lines[s:e+1]
        removed += 1
io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('移除抽屉项:', removed)
