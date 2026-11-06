import io
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""  Future<Map<String, dynamic>> registerUser({
    required String name,
    required String gender,
    required int age,
    required String originKind,
  }) async {""",
"""  Future<Map<String, dynamic>> registerUser({
    required String name,
    required String gender,
    required int age,
  }) async {""", 1)
s = s.replace("""          'age': age,
          'originKind': originKind,
        },""",
"""          'age': age,
        },""", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('客户端注册只发 名字/性别/年龄')
