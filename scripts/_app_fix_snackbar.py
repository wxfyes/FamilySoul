import io
# ② 提示条显示久一点（1.8s → 4s），并修正落点名字
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("duration: const Duration(milliseconds: 1800),", "duration: const Duration(seconds: 4),")
io.open(p, 'w', encoding='utf-8').write(s)
print('① 提示条 4 秒')

# ③ 天机助手：切回来自动到底（用 jumpTo 并重试两次）
p2 = 'mobile/lib/views/assistant_view.dart'
t = io.open(p2, encoding='utf-8').read()
old = """  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }"""
new = """  void _scrollToBottom() {
    void go() {
      if (!mounted || !_scrollController.hasClients) return;
      _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      go();
      // 列表还没量完时再补一次，保证切回来就在最新一条
      Future<void>.delayed(const Duration(milliseconds: 220), go);
      Future<void>.delayed(const Duration(milliseconds: 520), go);
    });
  }"""
if old in t and '保证切回来就在最新一条' not in t:
    t = t.replace(old, new, 1)
    io.open(p2, 'w', encoding='utf-8').write(t)
    print('② 助手切回自动到底')
