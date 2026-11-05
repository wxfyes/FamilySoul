import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()

# ① 真实粮价
if '_grainPrice' not in s:
    s = s.replace("  num get _grain => (_wang?['grain'] as num?) ?? 0;",
"""  num get _grain => (_wang?['grain'] as num?) ?? 0;

  /// 粮价走世界行情（明制一石约 0.6 两），不再写死 1 两
  double get _grainPrice {
    final m = (_world?['market'] as List?) ?? const [];
    for (final x in m) {
      if (x is Map && x['key'] == 'grain') {
        final p = (x['price'] as num?)?.toDouble();
        if (p != null && p > 0) return p;
      }
    }
    return 0.6;
  }""", 1)
    print('① 粮价走行情')

# ② 购粮按真实价
s = s.replace("""                    title: '购粮',
                    unit: '石',
                    unitPrice: 1.0,""",
"""                    title: '购粮',
                    unit: '石',
                    unitPrice: _grainPrice,""")
print('② 购粮显示真实粮价')

# ③ 招募失败要说清楚
old3 = """    } else if (r?['came'] != null) {"""
new3 = """    } else if (r?['error'] != null && r?['ok'] != true) {
      msg = '招募不成：${r?['error']}';
    } else if (r?['came'] != null) {"""
if old3 in s and '招募不成' not in s:
    s = s.replace(old3, new3, 1)
    print('③ 失败提示改清楚')
io.open(p, 'w', encoding='utf-8').write(s)
