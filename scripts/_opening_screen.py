import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
old = """  Future<void> _refreshPlace() async {"""
new = """  Future<void> _refreshPlace() async {
    // 本地没有历史时，请天道把"落地第一幕"补上（只成功一次）
    try {
      final provider = context.read<ChatProvider>();
      if (provider.messages.isEmpty) {
        await provider.ensureOpening();
      }
    } catch (_) {}
"""
if old in s and 'ensureOpening' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① chat_screen 调用 ensureOpening')
