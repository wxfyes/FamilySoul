import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
# 收税/减税/破产加税三处：同样按"0 就是 0"处理
s = s.replace("c.tax = Math.min(50, (Number(c.tax) || 10) + Math.round(amount / 2));",
              "c.tax = Math.min(50, (Number.isFinite(Number(c.tax)) ? Number(c.tax) : 10) + Math.round(amount / 2));")
s = s.replace("c.tax = Math.max(0, (Number(c.tax) || 10) - Math.round(amount / 2));",
              "c.tax = Math.max(0, (Number.isFinite(Number(c.tax)) ? Number(c.tax) : 10) - Math.round(amount / 2));")
s = s.replace("ct.tax = Math.min(50, (Number(ct.tax) || 10) + 2);",
              "ct.tax = Math.min(50, (Number.isFinite(Number(ct.tax)) ? Number(ct.tax) : 10) + 2);")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('加税/减税/破产三处一并修正')
