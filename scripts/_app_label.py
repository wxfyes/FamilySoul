import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()
# 家丁实际 1.2 两/人：显示按整数 1 两，但确认时传 unitCost 给提示；真实扣费由服务端算
# 这里把显示价与真实价的差异说清楚：unitPrice 用 1，按钮副标题写"约1.2两"
s = s.replace("""                  label: '募家丁',""", """                  label: '募家丁 ·1.2两',""")
s = s.replace("""                  label: '募护院',""", """                  label: '募护院 ·3两',""")
# 去掉不会被用到的 unitCost 键（服务端不认，留着会污染 body）
s = s.replace(", 'unitCost': 1.2", "")
s = s.replace(", 'unitCost': 3", "")
io.open(p, 'w', encoding='utf-8').write(s)
print('按钮写明单价')
