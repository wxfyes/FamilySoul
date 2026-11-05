import io
p = 'src/world/clock.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
# 删掉插错的第 8、9 行（0-based 7、8）
assert 'warfare.js' in lines[7], lines[7]
assert 'strategy.js' in lines[8], lines[8]
del lines[7:9]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('删掉插错的 import')
