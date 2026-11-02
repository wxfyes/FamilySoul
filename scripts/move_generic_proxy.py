import io

p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

start = None
for i, line in enumerate(lines):
    if '任何被点名的在场者' in line:
        start = i
        break
if start is None:
    print('WARN: block start not found')
else:
    # 结束：'点名代演失败' 的 catch 块结束 '}'
    end = None
    for j in range(start, start + 60):
        if '点名代演失败' in lines[j]:
            end = j + 1  # 下一个 '}' 是 catch 结束
            break
    while end is not None and lines[end].strip() != '}':
        end += 1
    block = lines[start:end + 1]

    # 找它外层 if 的结束：在 end 之后就一行 '        }'
    outer = None
    for k in range(end + 1, end + 6):
        if lines[k].strip() == '}':
            outer = k
            break
    if outer is None:
        print('WARN: outer close not found')
    else:
        rest = lines[:start] + lines[end + 1:]
        # 调整索引：outer 之后插入
        offset = len(block)
        new_outer = outer - offset
        out = rest[:new_outer + 1] + [''] + block + rest[new_outer + 1:]
        io.open(p, 'w', encoding='utf-8').write('\n'.join(out))
        print('moved generic proxy outside the askedHim block')
