import io
# App：家丁/护院 改走"招募(一呼百应)"，并显示月饷
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("action: 'recruit',\n                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'guard'}",
              "action: 'call',\n                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'guard'}")
s = s.replace("action: 'recruit',\n                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'retainer'}",
              "action: 'call',\n                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'retainer'}")
# 按钮文案
s = s.replace("label: '募家丁 ·1.2两',", "label: '招募家丁',")
s = s.replace("label: '募护院 ·3两',", "label: '招募护院',")
s = s.replace("title: '募家丁',", "title: '招募家丁',")
s = s.replace("title: '募护院',", "title: '招募护院',")
# 三宫格：存粮 → 月饷
s = s.replace("_stat('存粮', '${_grain.toStringAsFixed(0)} 石', _gold),", "_stat('月饷', '${_monthlyPay.toStringAsFixed(0)} 两', _gold),")
# 计算月饷 getter
s = s.replace("  int get _fresh => (_wang?['fresh'] as num?)?.toInt() ?? 0;",
              "  int get _fresh => (_wang?['fresh'] as num?)?.toInt() ?? 0;\n  num get _monthlyPay => (_wang?['monthlyPay'] as num?) ?? (_troops * 1.0);")
io.open(p, 'w', encoding='utf-8').write(s)
print('App 改为招募并显示月饷')
