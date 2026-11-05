import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
# 找到 assets 块里的 bandits 段并搬到 assets 之外
start = next(i for i, l in enumerate(lines) if 'bandits: Object.values(world.bandits' in l and i > 3100)
end = start
while '})),' not in lines[end]:
    end += 1
block = lines[start:end+1]
del lines[start:end+1]
# 找 assets 块结束：block 之后原位置现在是 "          },"
j = start
while lines[j].strip() != '},':
    j += 1
lines = lines[:j+1] + block + lines[j+1:]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('bandits 搬出 assets')
