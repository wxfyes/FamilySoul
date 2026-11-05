import io
p = 'src/world/state.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
# 删掉多余的 else a.age = 20 + ... 行
idx = next(i for i, l in enumerate(lines) if 'else a.age = 20 + (id.length % 25);' in l)
del lines[idx]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('删掉多余的兜底行')
