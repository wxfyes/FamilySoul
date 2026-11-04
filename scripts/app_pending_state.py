import io

p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
changed = []

# ① 状态
if '_pendingAction' not in s:
    s = s.replace("  List<String> _hereNames = const [];",
                  "  List<String> _hereNames = const [];\n  Map? _pendingAction;", 1)
    changed.append('状态')

# ② 解析（在刷新方法里）
old = """      if (place != _placeName || day != _worldDay || hour != _worldHour || here.join(',') != _hereNames.join(',')) {
        setState(() {
          _placeName = place;
          _worldDay = day;
          _worldHour = hour;
          _partyNames = names;
          _hereNames = here;
        });
      }"""
new = """      final pend = (d['pendingAction'] is Map) ? d['pendingAction'] as Map : null;
      if (place != _placeName || day != _worldDay || hour != _worldHour
          || here.join(',') != _hereNames.join(',')
          || '${pend?['id']}' != '${_pendingAction?['id']}') {
        setState(() {
          _placeName = place;
          _worldDay = day;
          _worldHour = hour;
          _partyNames = names;
          _hereNames = here;
          _pendingAction = pend;
        });
      }"""
if old in s:
    s = s.replace(old, new, 1)
    changed.append('解析')
else:
    print('WARN: 刷新块没匹配')

io.open(p, 'w', encoding='utf-8').write(s)
print('改动:', '、'.join(changed) if changed else '无')
