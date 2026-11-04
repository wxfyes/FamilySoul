import io
# 客户端：别再自己拼分隔符，改成拿一个对象
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
start = s.find("  /// 落地第一幕")
end = s.find("\n  }\n", start)
if start > 0 and end > start:
    new = '''  /// 落地第一幕：返回 {text, speaker}（没有就给 null）
  Future<Map<String, String>?> fetchOpening() async {
    try {
      final res = await _dio.post('${config.baseUrl}/api/world/opening',
          queryParameters: {'token': config.token.trim()});
      if (res.statusCode == 200 && res.data is Map) {
        final t = res.data['text'];
        if (t is String && t.trim().isNotEmpty) {
          final sp = res.data['speaker'];
          return {
            'text': t.trim(),
            'speaker': (sp is String && sp.isNotEmpty) ? sp : '旁白',
          };
        }
      }
    } catch (_) {}
    return null;
  }
'''
    s = s[:start] + new + s[end + len("\n  }\n"):]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① fetchOpening 返回对象')
