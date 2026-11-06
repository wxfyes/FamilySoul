import io
p = 'mobile/lib/widgets/register_dialog.dart'
lines = io.open(p, encoding='utf-8').read().split('\n')
# 删除"初入行当"整块（193 行起到其闭合 onChanged/), 处）
start = next(i for i, l in enumerate(lines) if '// 初入行当' in l)
end = start
depth = 0
for i in range(start, len(lines)):
    if 'DropdownButtonFormField<String>(' in lines[i]:
        depth = 1
    elif depth and lines[i].strip() == '),' and (len(lines[i]) - len(lines[i].lstrip())) <= 16:
        end = i
        break
del lines[start:end+1]
s = '\n'.join(lines)
# 删除状态与提交字段
s = s.replace("String _originKind = 'scholar';\n", "", 1)
s = s.replace("      originKind: _originKind,\n", "", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('删掉出身块与字段')
