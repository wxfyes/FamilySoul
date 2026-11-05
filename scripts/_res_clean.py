import io, re
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

# 删掉两段遗留的一次性宅院块
def drop_block(src, start_marker):
    i = src.find(start_marker)
    if i < 0:
        return src, False
    j = src.find('  // 一次性', i + 10)
    if j < 0:
        j = src.find('  // 每次读档巡检宅子', i + 10)
    if j < 0:
        j = len(src)
    return src[:i] + src[j:], True

for marker in ['  // 一次性：给所有宅子建出院子', '  // 一次性 v2：宅子按契纸规模升等']:
    s, ok = drop_block(s, marker)
    print(('去掉 ' if ok else '未找到 ') + marker.strip())

# 新玩家小院：用巡检入口（幂等）
s = s.replace("    try { ensureResidence(world, houseId); } catch { /* 忽略 */ }",
              "    try { buildAllResidences(world); } catch { /* 忽略 */ }")
io.open(p, 'w', encoding='utf-8-sig').write(s)
