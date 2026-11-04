import io
# App：进入聊天时若历史为空且未开场，自动请求落地第一幕
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
if 'fetchOpening' not in s:
    add = '''
  /// 落地第一幕：新人进世界时天道主动开口（只成功一次）
  Future<String?> fetchOpening() async {
    try {
      final res = await _dio.post('${config.baseUrl}/api/world/opening',
          queryParameters: {'token': config.token.trim()});
      if (res.statusCode == 200 && res.data is Map) {
        final t = res.data['text'];
        if (t is String && t.trim().isNotEmpty) return t.trim();
      }
    } catch (_) {}
    return null;
  }
}
'''
    idx = s.rfind('}')
    s = s[:idx] + add.lstrip('\n')
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① api_client 加 fetchOpening')
