import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# build 顶部加 isDark
s = s.replace("""    final provider = context.watch<ChatProvider>();
    final isOnline = provider.isConnected;
    final characterName = provider.petStatus.characterName;""",
"""    final provider = context.watch<ChatProvider>();
    final isOnline = provider.isConnected;
    final characterName = provider.petStatus.characterName;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final locSub = isDark ? Colors.white38 : const Color(0xFF64748B);""", 1)

# 位置条三处颜色改成主题自适应
s = s.replace("style: const TextStyle(color: Colors.white30, fontSize: 11.5),",
              "style: TextStyle(color: isDark ? Colors.white30 : const Color(0xFF475569), fontSize: 11.5),", 1)
s = s.replace("style: const TextStyle(color: Colors.white38, fontSize: 11),",
              "style: TextStyle(color: locSub, fontSize: 11),", 1)
s = s.replace("const Icon(Icons.keyboard_arrow_right_rounded, size: 15, color: Colors.white",
              "Icon(Icons.keyboard_arrow_right_rounded, size: 15, color: isDark ? Colors.white : const Color(0xFF94A3B8)", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('① 位置条颜色随主题')
