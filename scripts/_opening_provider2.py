import io
p = 'mobile/lib/providers/chat_provider.dart'
d = io.open(p, encoding='utf-8').read()
old = """      final raw = await _apiClient.fetchOpening();
      if (raw == null || raw.trim().isEmpty) return;
      final parts = raw.split('\\u0001');
      final speaker = parts.length > 1 ? parts[0] : '旁白';
      final text = parts.length > 1 ? parts[1] : raw;"""
new = """      final raw = await _apiClient.fetchOpening();
      if (raw == null) return;
      final text = (raw['text'] ?? '').trim();
      final speaker = (raw['speaker'] ?? '旁白').trim();
      if (text.isEmpty) return;"""
if old in d:
    d = d.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(d)
    print('② provider 用对象')
