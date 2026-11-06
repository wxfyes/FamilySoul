import io
p = 'mobile/lib/widgets/message_bubble.dart'
lines = io.open(p, encoding='utf-8').read().split('\n')

# 删除"按名字硬编码身份"的分支（婉儿/芸娘/小翠/名伶/掌柜/知府），只保留 我 / 旁白 / 身份·名字 / 兜底
start = None
for i, l in enumerate(lines):
    if "if (s.contains('婉儿')" in l:
        start = i
        break
end = None
if start is not None:
    for i in range(start, len(lines)):
        if '// 6.5 服务端给了身份前缀' in lines[i]:
            end = i
            break
if start is not None and end is not None:
    removed = end - start
    lines[start:end] = []
    io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
    print('删掉按名字硬编码的', removed, '行')
else:
    print('未找到范围', start, end)
