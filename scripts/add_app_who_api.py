import io

# ① API 客户端：行踪
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8-sig').read()
if 'fetchWho' not in s:
    anchor = "  /// 检查服务连通性与健康状态"
    add = (
        "  /// 行踪：谁在哪（只返回名字/身份/地点）\n"
        "  Future<List<Map<String, dynamic>>> fetchWho({String q = ''}) async {\n"
        "    try {\n"
        "      final res = await _dio.get('/api/who', queryParameters: {'token': config.token.trim(), if (q.isNotEmpty) 'q': q});\n"
        "      if (res.statusCode == 200 && res.data is Map && res.data['rows'] is List) {\n"
        "        return (res.data['rows'] as List).cast<Map<String, dynamic>>();\n"
        "      }\n"
        "    } catch (_) {}\n"
        "    return const [];\n"
        "  }\n\n"
    )
    s = s.replace(anchor, add + anchor, 1)
    print('added fetchWho')
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
