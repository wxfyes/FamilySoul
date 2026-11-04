import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
old = """              onTap: () async {
                Navigator.pop(context);
                final ctrlA = TextEditingController();"""
new = """              onTap: () async {
                final messengerP = ScaffoldMessenger.of(context);
                Navigator.pop(context);
                final ctrlA = TextEditingController();"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 提前抓 messenger')
s = s.replace("                final messenger = ScaffoldMessenger.of(context);\n", "")
s = s.replace("                  messenger.showSnackBar(", "                  messengerP.showSnackBar(")
io.open(p, 'w', encoding='utf-8').write(s)
