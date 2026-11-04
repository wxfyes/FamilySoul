import io

# ① api_client：pay 接口
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
if 'Future<String?> payLodging' not in s:
    add = '''
  /// 开房付款：option = '上房' | '通铺'。成功返回"（你付了X两…）"
  Future<String?> payLodging(String option) async {
    try {
      final res = await _dio.post('${config.baseUrl}/api/world/pay',
          queryParameters: {'token': config.token.trim()},
          data: {'kind': 'lodging', 'option': option});
      if (res.statusCode == 200 && res.data is Map) {
        if (res.data['ok'] == true) {
          final line = res.data['line'];
          return line is String && line.isNotEmpty ? line : '（已付钱进房。）';
        }
        final err = res.data['error'];
        if (err is String) return '（$err）';
      }
    } catch (_) {}
    return null;
  }
}
'''
    idx = s.LastIndexOf('}')
    s = s[:idx] + add.lstrip('\n')
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 加 payLodging')

# ② chat_screen：有待付的开房 → 位置条下浮一条确认条
p2 = 'mobile/lib/views/chat_screen.dart'
d = io.open(p2, encoding='utf-8').read()

if '_pendingAction' not in d:
    d = d.replace("  List<String> _hereNames = const [];",
                  "  List<String> _hereNames = const [];\n  Map? _pendingAction;", 1)
    print('② 状态 _pendingAction')

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
          || pend?['id'] != _pendingAction?['id']) {
        setState(() {
          _placeName = place;
          _worldDay = day;
          _worldHour = hour;
          _partyNames = names;
          _hereNames = here;
          _pendingAction = pend;
        });
      }"""
    if old in d:
        d = d.replace(old, new, 1)
        print('③ 解析 pendingAction')

io.open(p2, 'w', encoding='utf-8').write(d)
print('done')
