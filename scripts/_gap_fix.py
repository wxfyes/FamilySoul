import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
old = """    try {
      final provider = context.read<ChatProvider>();
      if (provider.messages.isEmpty) {
        await provider.ensureOpening();
      }
    } catch (_) {}
"""
new = """    ChatProvider? provider0;
    try { provider0 = context.read<ChatProvider>(); } catch (_) {}
    try {
      if (provider0 != null && provider0.messages.isEmpty) {
        await provider0.ensureOpening();
      }
    } catch (_) {}
    final api0 = provider0?.api;
"""
if old in s:
    s = s.replace(old, new, 1)
    s = s.replace("      final d = await context.read<ChatProvider>().api.fetchMyWorld();",
                  "      final d = await api0?.fetchMyWorld();")
    s = s.replace("      if (!mounted || d == null) return;", "      if (!mounted || d == null) return;")
    io.open(p, 'w', encoding='utf-8').write(s)
    print('去掉 async gap 的 context 使用')
