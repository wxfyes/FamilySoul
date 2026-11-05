import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
# 删除 4315 行（0-based 4314）多余的 "  }"
idx = 4314
if lines[idx].strip() == '}' and lines[idx-1].strip() == '':
    del lines[idx]
    io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
    print('删掉多余的右括号')
else:
    print('位置不符:', repr(lines[idx-1]), repr(lines[idx]))
