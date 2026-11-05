import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()

# 读取欠饷
s = s.replace("  num get _monthlyPay => (_wang?['monthlyPay'] as num?) ?? (_troops * 1.0);",
              "  num get _monthlyPay => (_wang?['monthlyPay'] as num?) ?? (_troops * 1.0);\n  Map<String, dynamic> get _arrears => (_wang?['arrears'] as Map?)?.cast<String, dynamic>() ?? const {};\n  int get _arrearsMonths => (_arrears['months'] as num?)?.toInt() ?? 0;\n  num get _arrearsOwed => (_arrears['owed'] as num?) ?? 0;")

# 有欠饷时显示红色提示 + 胶囊补饷
s = s.replace("""              const SizedBox(height: 16),
              Wrap(spacing: 10, runSpacing: 10, children: [""",
"""              if (_arrearsMonths > 0) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
                  ),
                  child: Row(children: [
                    const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFEF4444)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('欠饷 $_arrearsMonths 月，共 ${_arrearsOwed.toStringAsFixed(0)} 两',
                          style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 12.5)),
                    ),
                    InkWell(
                      onTap: _busy
                          ? null
                          : () async {
                              await _act({'action': 'pay_arrears'}, '积欠已清，军心大定');
                            },
                      borderRadius: BorderRadius.circular(999),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text('补发欠饷', style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 12)),
                      ),
                    ),
                  ]),
                ),
              ],
              const SizedBox(height: 16),
              Wrap(spacing: 10, runSpacing: 10, children: [""")
io.open(p, 'w', encoding='utf-8').write(s)
print('面板加欠饷提示与补饷')
