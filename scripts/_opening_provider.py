import io
# provider：加一个公开方法，把"落地第一幕"作为一条 AI 消息插进本地历史
p = 'mobile/lib/providers/chat_provider.dart'
s = io.open(p, encoding='utf-8').read()
if 'Future<void> ensureOpening' not in s:
    method = '''
  /// 落地第一幕：本地没有历史时，请天道主动开口一次
  Future<void> ensureOpening() async {
    if (_messages.isNotEmpty) return;
    try {
      final text = await _apiClient.fetchOpening();
      if (text == null || text.trim().isEmpty) return;
      _messages.add(ChatMessage(
        id: 'opening_${DateTime.now().millisecondsSinceEpoch}',
        role: 'assistant',
        text: text,
        time: DateTime.now(),
      ));
      _persistMessages();
      notifyListeners();
    } catch (_) {}
  }
'''
    idx = s.find('  Future<void> saveRoutineConfig(')
    if idx > 0:
        s = s[:idx] + method + '\n' + s[idx:]
    else:
        s = s.rstrip()[:-1] + method + '}\n'
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① provider 加 ensureOpening')
