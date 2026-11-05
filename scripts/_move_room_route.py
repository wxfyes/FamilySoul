import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
start = next(i for i, l in enumerate(lines) if '// 院子里有什么' in l)
end = start
while not (lines[end].strip() == '}' and lines[end-1].strip() == ''):
    end += 1
block = lines[start:end+1]
del lines[start:end+1]
# 插到 /world/menu 路由块的结束之后
menu = next(i for i, l in enumerate(lines) if "matchRoute('/world/menu')" in l)
j = menu
depth_ok = False
while j < len(lines):
    if lines[j].strip() == '}' and lines[j+1].strip() == '':
        depth_ok = True
        break
    j += 1
lines = lines[:j+1] + [''] + block + lines[j+1:]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('房间路由搬到 menu 之后（行', j+1, '）')
