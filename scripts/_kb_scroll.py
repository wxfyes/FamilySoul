import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# 键盘弹出时，如果本来在底部，就把最新消息顶上来
old = "  final FocusNode _inputFocus = FocusNode();"
new = """  final FocusNode _inputFocus = FocusNode();
  bool _kbScrolled = false;"""
if old in s and '_kbScrolled' not in s:
    s = s.replace(old, new, 1)
    print('① 加标记')

# initState 里监听焦点：键盘弹出后自动贴底
old2 = """    _inputFocus.addListener(() {"""
if old2 not in s:
    # 在 build 之前插入监听（放到 initState 中）
    anchor = "  @override\n  void initState() {"
    add = """  @override
  void initState() {
    super.initState();
    // 键盘弹出/收起后，若本来就在底部，自动贴到最新一条
    _inputFocus.addListener(() {
      if (_inputFocus.hasFocus) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Future<void>.delayed(const Duration(milliseconds: 260), () {
            if (mounted && _isNearBottom(threshold: 260)) _scrollToBottom(force: true);
          });
        });
        _kbScrolled = true;
      }
    });
"""
    if anchor in s:
        s = s.replace(anchor, add, 1)
        print('② initState 加焦点监听')
io.open(p, 'w', encoding='utf-8').write(s)
