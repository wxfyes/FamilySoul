import io
# 世界聊天：从助手切回来，强制回到底部
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
old = """          setState(() {
            _activeDomainIndex = index;
          });"""
new = """          setState(() {
            _activeDomainIndex = index;
          });
          // 切回世界：不管之前滚到哪，都回到最新一条
          if (index == 0) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _scrollToBottom(force: true);
              Future<void>.delayed(const Duration(milliseconds: 180), () {
                if (mounted) _scrollToBottom(force: true);
              });
            });
          }"""
if old in s and '切回世界' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 切回世界自动到底')
