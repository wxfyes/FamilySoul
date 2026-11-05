import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
# 找隔空应声块并整段注释掉（改成空实现），保证只有同场的人说话
import re
start = s.find("          // 隔着地方喊相公：他不能瞬移，但可以应一声（他是真人，由天道代他开口）")
if start < 0:
    start = s.find("const calledHusband =")
if start > 0:
    end = s.find("          const namedPresent = Object.values(wPost.actors || {}).filter(", start)
    if end > start:
        block = s[start:end]
        s = s[:start] + "          // 物理在场铁律：不在同一地点的人，绝不隔空搭话（此前的远程应声已移除）\n" + s[end:]
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('已移除隔空应声块，共', len(block.split(chr(10))), '行')
    else:
        print('未找到块尾')
else:
    print('未找到块首')
