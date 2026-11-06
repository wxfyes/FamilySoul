import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            const back = a.quarters || a.home || 'street';"""
new = """            // 有住处回住处；没住处就回他当差的铺子；再没有就去客栈
            let back = a.quarters || a.home;
            if (!back) {
              const prop = (wF.assets?.properties || []).find((x) => x && String(x.keeper || '') === String(a.id) && x.place);
              back = prop?.place || null;
            }
            if (!back) back = wF.places?.inn ? 'inn' : 'street';"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('patched back-home fallback')
