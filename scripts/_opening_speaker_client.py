import io
# 客户端：开场消息带上说话人（旁白或过门人）
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
old = """      if (res.statusCode == 200 && res.data is Map) {
        final t = res.data['text'];
        if (t is String && t.trim().isNotEmpty) return t.trim();
      }"""
new = """      if (res.statusCode == 200 && res.data is Map) {
        final t = res.data['text'];
        final sp = res.data['speaker'];
        if (t is String && t.trim().isNotEmpty) {
          return '${sp is String && sp.isNotEmpty ? sp : '旁白'}\\u0001${t.trim()}';
        }
      }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① api 返回带说话人（用 \\u0001 分隔）')

p2 = 'mobile/lib/providers/chat_provider.dart'
d = io.open(p2, encoding='utf-8').read()
old2 = """      final text = await _apiClient.fetchOpening();
      if (text == null || text.trim().isEmpty) return;
      _messages.add(ChatMessage(
        id: 'opening_${DateTime.now().millisecondsSinceEpoch}',
        text: text,
        isUser: false,
        timestamp: DateTime.now(),
      ));"""
new2 = """      final raw = await _apiClient.fetchOpening();
      if (raw == null || raw.trim().isEmpty) return;
      final parts = raw.split('\\u0001');
      final speaker = parts.length > 1 ? parts[0] : '旁白';
      final text = parts.length > 1 ? parts[1] : raw;
      _messages.add(ChatMessage(
        id: 'opening_${DateTime.now().millisecondsSinceEpoch}',
        text: text,
        isUser: false,
        timestamp: DateTime.now(),
        speaker: speaker,
      ));"""
if old2 in d:
    d = d.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8').write(d)
    print('② provider 解析说话人')
