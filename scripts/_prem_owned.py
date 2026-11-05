import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    // 只给"有主/有掌柜"的铺子建，野摊不建
    const owned = p.owner || p.keeper || (world.assets?.properties || []).some((x) => x && (x.place === pid || (x.name && String(p.name || '').includes(String(x.name).split('（')[0]))));
    if (!owned) continue;"""
new = """    // 有名有姓的铺子都给它把前店后坊补上（野摊不建）"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('经营场所不再要求有主')
