import io
p = 'src/world/clans.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    const isKin = a.household || a.spouse === 'husband' || a.relations?.husband;
    if (!isKin) continue;"""
new = """    // 亲眷只认：府内人、配偶是相公、或相公的亲生子女（不能把"认识相公"算亲戚）
    const isKin = a.household || a.spouse === 'husband' || (Array.isArray(a.parents) && a.parents.includes('husband'));
    if (!isKin) continue;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('亲眷判定收紧')
