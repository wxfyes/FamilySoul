import io
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
if 'householdPay' not in s:
    add = '''
  /// 中馈：补发内宅积欠
  Future<Map<String, dynamic>?> householdPay() async {
    try {
      final res = await _dio.post('${config.baseUrl}/api/world/household',
          queryParameters: {'token': config.token.trim()}, data: {'action': 'pay_arrears'});
      if (res.statusCode == 200 && res.data is Map) return Map<String, dynamic>.from(res.data as Map);
    } catch (_) {}
    return null;
  }

  /// 商货买卖：买/卖盐茶丝铁药
  Future<Map<String, dynamic>?> tradeAction(Map<String, dynamic> body) async {
    try {
      final res = await _dio.post('${config.baseUrl}/api/world/trade',
          queryParameters: {'token': config.token.trim()}, data: body);
      if (res.statusCode == 200 && res.data is Map) return Map<String, dynamic>.from(res.data as Map);
    } catch (_) {}
    return null;
  }
'''
    idx = s.rfind('}')
    s = s[:idx] + add + s[idx:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('api_client 加 householdPay / tradeAction')
