import io
# 兵面板：不是家主就显示"私兵由相公掌管"，并禁用按钮
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()
old = "  num get _grain => (_wang?['grain'] as num?) ?? 0;"
new = """  num get _grain => (_wang?['grain'] as num?) ?? 0;

  /// 只有家主能操盘私兵：服务端会把非家主的 troops/grain 返回 null
  bool get _isBoss => _wang != null && _wang?['hidden'] != true;"""
if old in s and 'bool get _isBoss' not in s:
    s = s.replace(old, new, 1)
    # 顶部加提示条
    s = s.replace("""              Wrap(spacing: 10, runSpacing: 10, children: [""",
"""              if (!_isBoss)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
                  ),
                  child: const Text(
                    '王家私兵由家主掌管，你只能看不能调。',
                    style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 12),
                  ),
                ),
              Wrap(spacing: 10, runSpacing: 10, children: [""", 1)
    # 按钮全部禁用
    s = s.replace("                  onTap: () => _pickCount(", "                  onTap: _isBoss ? () => _pickCount(")
    s = s.replace("                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'guard'},\n                  ),",
                  "                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'guard'},\n                  ) : null,")
    s = s.replace("                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'retainer'},\n                  ),",
                  "                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'retainer'},\n                  ) : null,")
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 家兵面板按身份限制')
