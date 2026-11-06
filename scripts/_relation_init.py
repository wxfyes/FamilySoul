import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        mine.trust = Math.min(100, Math.round(((Number(mine.trust) || 0) + 1) * 10) / 10);"""
new = """        // 初次打交道：先有"一面之缘"的底子，再涨这一分
        if (mine.trust == null) mine.trust = 5;
        if (mine.desire == null) mine.desire = 0;
        mine.trust = Math.min(100, Math.round(((Number(mine.trust) || 0) + 1) * 10) / 10);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('初识底子')
