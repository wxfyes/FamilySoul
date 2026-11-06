import io
p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
# 删除 1296..1321（1-based），保留空行
del lines[1295:1321]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('删除旧块 1296-1321')
