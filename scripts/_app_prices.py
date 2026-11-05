import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()

# ① 统一从服务端价目取价（没有就退回默认值）
if 'double _priceOf(' not in s:
    s = s.replace("  /// 粮价走世界行情（明制一石约 0.6 两），不再写死 1 两",
"""  /// 价格一律问服务端要（/api/me.prices），拿不到才用兜底值
  double _priceOf(String key, double fallback) {
    final m = (_world?['prices'] as Map?)?.cast<String, dynamic>();
    final v = (m?[key] as num?)?.toDouble();
    return (v != null && v > 0) ? v : fallback;
  }

  /// 粮价走世界行情（明制一石约 0.6 两），不再写死 1 两""", 1)
    print('① 加 _priceOf')

# ② 粮价/购粮改用它
s = s.replace("""  double get _grainPrice {
    final m = (_world?['market'] as List?) ?? const [];
    for (final x in m) {
      if (x is Map && x['key'] == 'grain') {
        final p = (x['price'] as num?)?.toDouble();
        if (p != null && p > 0) return p;
      }
    }
    return 0.6;
  }""",
"""  double get _grainPrice {
    final direct = _priceOf('grain', 0);
    if (direct > 0) return direct;
    final m = (_world?['market'] as List?) ?? const [];
    for (final x in m) {
      if (x is Map && x['key'] == 'grain') {
        final p = (x['price'] as num?)?.toDouble();
        if (p != null && p > 0) return p;
      }
    }
    return 0.4;
  }""")
print('② 粮价优先服务端')

# ③ 兵器/铠甲/战马/攻城器械/家丁/护院 全改成服务端价
s = s.replace("                    unitPrice: 0.2,\n                    grainPer: 0.2,", "                    unitPrice: _priceOf('guard_gift', 0.2),\n                    grainPer: 0.2,")
s = s.replace("                    unitPrice: 0.5,\n                    grainPer: 0.3,", "                    unitPrice: _priceOf('retainer_gift', 0.5),\n                    grainPer: 0.3,")
for old, key, fb in [("unitPrice: 0.6,", "weapon", 0.6), ("unitPrice: 1.8,", "armor", 1.8), ("unitPrice: 12.0,", "horse", 12.0), ("unitPrice: 40.0,", "siege", 40.0), ("unitPrice: 9.0,", "horse", 12.0)]:
    s = s.replace(old, f"unitPrice: _priceOf('{key}', {fb}),")
print('③ 军械按服务端价')

# ④ 购粮弹层的标签不该叫"安家银"
s = s.replace("Text('安家银 ${unitPrice.toStringAsFixed(2)} 两 / $unit'",
              "Text('${title == '购粮' ? '粮价' : '安家银'} ${unitPrice.toStringAsFixed(2)} 两 / $unit'")
print('④ 购粮标签改"粮价"')
io.open(p, 'w', encoding='utf-8').write(s)
