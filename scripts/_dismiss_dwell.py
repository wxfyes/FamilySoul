import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { knock, grantPass, residenceOf } from './world/visit.js';",
              "import { knock, grantPass, residenceOf } from './world/visit.js';\nimport { ensureDwelling } from './world/dwelling.js';", 1)
old = """            // 有住处回住处；没住处就回他当差的铺子；再没有就去客栈
            let back = a.quarters || a.home;
            if (!back) {
              const prop = (wF.assets?.properties || []).find((x) => x && String(x.keeper || '') === String(a.id) && x.place);
              back = prop?.place || null;
            }
            if (!back) back = wF.places?.inn ? 'inn' : 'street';"""
new = """            // 有住处回住处；住在街上的人，给他安个家再让他回去（不让人凭空消失）
            let back = a.quarters || a.home;
            const backPlace = back ? wF.places?.[back] : null;
            if (!back || !backPlace || backPlace.residence === undefined && !backPlace.name) {
              try { back = ensureDwelling(wF, a.id, a.name, 'street'); } catch { back = null; }
            }
            if (!back || back === 'street') {
              const prop = (wF.assets?.properties || []).find((x) => x && String(x.keeper || '') === String(a.id) && x.place);
              back = prop?.place || null;
            }
            if (!back) back = 'street';"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('patched homeless -> ensureDwelling')
