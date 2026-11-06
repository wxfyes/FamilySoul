import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
pat_old = "后坊|库房|后厨|酒窖|雅间|上房|暖阁|厢房|卧房|下房|值房|账房|书房|祠堂|仓房|柴房|马厩"
pat_new = "后坊|库房|后厨|酒窖|雅间|上房|暖阁|厢房|卧房|下房|值房|账房|书房|祠堂|仓房|柴房|马厩|雅阁|天字阁"
s = s.replace(pat_old, pat_new)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('① 雅阁/天字阁也算私房')
