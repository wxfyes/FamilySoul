import io
# ① api_client：通用确认
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
if 'confirmPayment' not in s:
    add = '''
  /// 确认一笔待付款：option 是选项 key（luxury/cheap/pay…）
  Future<String?> confirmPayment(String option, {String? actionId}) async {
    try {
      final res = await _dio.post('${config.baseUrl}/api/world/confirm',
          queryParameters: {'token': config.token.trim()},
          data: {'option': option, if (actionId != null) 'actionId': actionId});
      if (res.statusCode == 200 && res.data is Map) {
        if (res.data['ok'] == true) {
          final line = res.data['line'];
          return line is String && line.isNotEmpty ? line : '（已付。）';
        }
        final err = res.data['error'];
        if (err is String) return '（$err）';
      }
    } catch (_) {}
    return null;
  }
}
'''
    idx = s.rfind('}')
    s = s[:idx] + add.lstrip('\n')
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 加 confirmPayment')
