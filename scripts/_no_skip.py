import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
# 两个生成器不再跳过"已有房间"的铺子/衙门，而是补齐+改名
s = s.replace("""    if (!ownsPremises && false) continue;""", "")
s = s.replace("""    const kind = premisesKind(p.name);
    if (!kind) continue;""",
"""    const kind = premisesKind(p.name);
    if (!kind) continue;
    // 已有房间也要进来（补缺 + 改名），不能直接跳过""")
s = s.replace("""    if (p.rooms && Object.keys(p.rooms).length) continue;
    p.rooms = p.rooms || {};
    p.exits = Array.isArray(p.exits) ? p.exits : ['street'];
    const segs = String(p.name || '铺').split('·')""",
"""    p.rooms = p.rooms || {};
    p.exits = Array.isArray(p.exits) ? p.exits : ['street'];
    const segs = String(p.name || '铺').split('·')""")
s = s.replace("""    if (!/衙|县衙|府衙|公堂/.test(String(p.name || ''))) continue;
    if (p.rooms && Object.keys(p.rooms).length) continue;
    p.rooms = p.rooms || {};""",
"""    if (!/衙|县衙|府衙|公堂/.test(String(p.name || ''))) continue;
    p.rooms = p.rooms || {};""")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('经营/衙署生成器改为补齐改名')
