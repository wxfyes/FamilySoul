import io
# ① 人物投影补 spouseName（婚配显示要用）
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "            marital: a.marital || null,"
new = "            marital: a.marital || null,\n            spouseId: a.spouse || null,\n            spouseName: a.spouse ? (world.actors?.[a.spouse]?.name || '') : '',"
if old in s and 'spouseName:' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 投影补 spouseName')
