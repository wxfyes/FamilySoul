import io
# ① 税率：0 就是 0，不再被 || 当缺省
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "    const tax = Math.max(0, Math.min(50, Number(ct.tax) || 10));"
new = "    const rawTax = Number(ct.tax);\n    const tax = Math.max(0, Math.min(50, Number.isFinite(rawTax) ? rawTax : 10));"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 税率 0 不再被当 10')
