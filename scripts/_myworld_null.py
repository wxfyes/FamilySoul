import io
# 前端：household 为 null 时不显示中馈
p = 'mobile/lib/views/my_world_screen.dart'
s = io.open(p, encoding='utf-8').read()
old = """    final household = (d['household'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};"""
new = """    final householdMap = (d['household'] as Map?)?.cast<String, dynamic>();
    final household = householdMap ?? const <String, dynamic>{};"""
if old in s:
    s = s.replace(old, new, 1)
    print('① household 可为 null')

old2 = """            _kv('中馈月例', '${hhAllowance.toStringAsFixed(1)} 两/月'),"""
new2 = """            if (householdMap != null && hhAllowance > 0)
              _kv('中馈月例', '${hhAllowance.toStringAsFixed(1)} 两/月'),"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 非内宅人隐藏中馈行')
io.open(p, 'w', encoding='utf-8').write(s)
