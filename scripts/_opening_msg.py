import io
p = 'mobile/lib/providers/chat_provider.dart'
s = io.open(p, encoding='utf-8').read()
old = """      _messages.add(ChatMessage(
        id: 'opening_${DateTime.now().millisecondsSinceEpoch}',
        role: 'assistant',
        text: text,
        time: DateTime.now(),
      ));"""
new = """      _messages.add(ChatMessage(
        id: 'opening_${DateTime.now().millisecondsSinceEpoch}',
        text: text,
        isUser: false,
        timestamp: DateTime.now(),
      ));"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('修 ChatMessage 参数')
