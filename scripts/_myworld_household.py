import io
p = 'mobile/lib/views/my_world_screen.dart'
s = io.open(p, encoding='utf-8').read()

# ① 解析 household
if "_household" not in s:
    s = s.replace("    final props = (assets['properties'] as List?) ?? const [];",
                  "    final props = (assets['properties'] as List?) ?? const [];\n    final household = (d['household'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};\n    final hhAllowance = (household['allowance'] as num?)?.toDouble() ?? 4.0;\n    final hhArrears = (household['arrears'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};\n    final hhMonths = (hhArrears['months'] as num?)?.toInt() ?? 0;\n    final hhOwed = (hhArrears['owed'] as num?)?.toDouble() ?? 0;", 1)
    print('解析中馈字段')

# ② 家底卡里加中馈行
old = """            _kv('现银', '${_num(assets['silver'], digits: 2)} 两'),
            _kv('日入', '${_num(assets['daily'], digits: 2)} 两/日'),"""
new = """            _kv('现银', '${_num(assets['silver'], digits: 2)} 两'),
            _kv('日入', '${_num(assets['daily'], digits: 2)} 两/日'),
            _kv('中馈月例', '${hhAllowance.toStringAsFixed(1)} 两/月'),
            if (hhMonths > 0)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(children: [
                  Expanded(
                    child: Text('中馈欠拨 $hhMonths 月，共 ${hhOwed.toStringAsFixed(1)} 两',
                        style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 12.5)),
                  ),
                  InkWell(
                    onTap: () async {
                      final r = await api.householdPay();
                      if (!mounted) return;
                      final ok = r?['ok'] == true;
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(ok ? (r?['text']?.toString() ?? '已补发') : (r?['error']?.toString() ?? '没办成')),
                        behavior: SnackBarBehavior.floating,
                        duration: const Duration(milliseconds: 1600),
                      ));
                      if (ok) setState(() {});
                    },
                    borderRadius: BorderRadius.circular(999),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text('补发中馈', style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 12)),
                    ),
                  ),
                ]),
              ),"""
if old in s:
    s = s.replace(old, new, 1)
    print('家底卡加中馈与补发按钮')
io.open(p, 'w', encoding='utf-8').write(s)
