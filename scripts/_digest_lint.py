import io
p = 'mobile/lib/views/digest_sheet.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("'${(d['grain'] as num?)?.toStringAsFixed(1) ?? '-'} 石'", "'${(d['grain'] as num?)?.toStringAsFixed(1) ?? '-'} 石'")
s = s.replace("Text('第${d['day'] ?? '-'}日 ${d['hour'] ?? ''}时'", "Text('第${d['day'] ?? '-'}日 ${d['hour'] ?? ''}时'")
# 修 line104 的多余花括号
s = s.replace("color: priceMove > 0 ? const Color(0xFFFCA5A5) : const Color(0xFF86EFAC)", "color: priceMove > 0 ? const Color(0xFFFCA5A5) : const Color(0xFF86EFAC)")
s = s.replace("'涨 $priceMove' : '跌 ${-priceMove}'", "'涨 $priceMove' : '跌 ${-priceMove}'")
s = s.replace("'${(d['silver'] as num?)?.toStringAsFixed(1) ?? '-'} 两'", "'${(d['silver'] as num?)?.toStringAsFixed(1) ?? '-'} 两'")
s = s.replace("'${p['name'] ?? ''}${(p['status'] ?? '') == '' ? '' : ' · ${p['status']}'}'", "'${p['name'] ?? ''}${(p['status'] ?? '') == '' ? '' : " · ${p['status']}"}'")
io.open(p, 'w', encoding='utf-8').write(s)
print('修 lint')
