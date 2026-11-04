import io
# ① 接口地址：apiPrefix 带 /dsh-surfcore/pet-api，改为直接拼 baseUrl
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
for path in ['/api/world/menu', '/api/world/go', '/api/world/summon', '/api/world/todo']:
    s = s.replace(f"_dio.get('{path}',", f"_dio.get('${{config.baseUrl}}{path}',")
    s = s.replace(f"_dio.post('{path}',", f"_dio.post('${{config.baseUrl}}{path}',")
io.open(p, 'w', encoding='utf-8').write(s)
print('① 接口地址改为 baseUrl 直拼')

# ② 抽屉时间：用 date.day/hour
p2 = 'mobile/lib/views/chat_screen.dart'
c = io.open(p2, encoding='utf-8').read()
c = c.replace(
  "final day = (snap.data?['clock'] is Map) ? snap.data!['clock'] as Map : const {};",
  "final day = (snap.data?['date'] is Map) ? snap.data!['date'] as Map : const {};")
c = c.replace(
  "'$place · 第${day['day'] ?? date['day'] ?? '-'}日 ${day['hour'] ?? '-'}时'",
  "'$place · 第${day['day'] ?? '-'}日 ${day['hour'] ?? '-'}时'")
io.open(p2, 'w', encoding='utf-8').write(c)
print('② 抽屉时间改用 date')
