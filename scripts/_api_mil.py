import io
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
if 'militaryAction' not in s:
    add = '''
  /// 兵事：募兵 / 买粮 / 买军械 / 出征 / 调防
  Future<Map<String, dynamic>?> militaryAction(Map<String, dynamic> body) async {
    try {
      final res = await _dio.post('${config.baseUrl}/api/world/military',
          queryParameters: {'token': config.token.trim()}, data: body);
      if (res.statusCode == 200 && res.data is Map) {
        return Map<String, dynamic>.from(res.data as Map);
      }
    } catch (_) {}
    return null;
  }
'''
    idx = s.rfind('}')
    s = s[:idx] + add + s[idx:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① api_client 加 militaryAction')
