import io
p = 'mobile/lib/views/assistant_view.dart'
s = io.open(p, encoding='utf-8').read()
start = s.find('  void _scrollToBottom() {')
end = s.find('\n  }', start)
if start > 0 and end > 0:
    new = """  void _scrollToBottom() {
    // 列表是 reverse 的：0 就是最新一条
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) return;
      _scrollController.jumpTo(0);
    });
  }"""
    s = s[:start] + new + s[end+3:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('滚动改为跳 0（最新）')
