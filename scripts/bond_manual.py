import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'manual: true' not in s:
    import re
    # bond 分支里写入的两侧
    old1 = "world.bonds[aId][bId] = { type, score: sc };"
    new1 = "world.bonds[aId][bId] = { type, score: sc, manual: true };"
    old2 = "world.bonds[bId][aId] = { type, score: sc };"
    new2 = "world.bonds[bId][aId] = { type, score: sc, manual: true };"
    hit = 0
    if old1 in s:
        s = s.replace(old1, new1, 1); hit += 1
    if old2 in s:
        s = s.replace(old2, new2, 1); hit += 1
    print('patched bond manual flag:', hit)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
