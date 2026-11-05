import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
old = """                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _handleSend(),"""
new = """                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _handleSend(),
                          // iOS 上点别处也要能把键盘收回去
                          onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),"""
if old in s and 'onTapOutside' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 输入框点外面收键盘')
