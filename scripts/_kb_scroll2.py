import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("  bool _kbScrolled = false;\n", "", 1)
s = s.replace("        _kbScrolled = true;\n", "", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('去掉未用字段')
