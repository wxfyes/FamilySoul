import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
old = "                                final date = (snap.data?['date'] is Map) ? snap.data!['date'] as Map : const {};\n"
if old in s:
    s = s.replace(old, "", 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('去掉未用的 date 变量')
