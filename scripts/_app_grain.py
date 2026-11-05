import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()
# 存粮还有用（买粮要看），放到底部军械那行一起显示
s = s.replace("""              if (_gear.isNotEmpty) ...[""",
"""              Text('存粮 ${_grain.toStringAsFixed(0)} 石 · 月饷 ${_monthlyPay.toStringAsFixed(0)} 两/月 · 月粮 ${((_wang?['monthlyGrain'] as num?) ?? 0).toStringAsFixed(0)} 石/月',
                  style: const TextStyle(color: Colors.white38, fontSize: 12)),
              if (_gear.isNotEmpty) ...[""")
io.open(p, 'w', encoding='utf-8').write(s)
print('底部显示存粮与月饷')
