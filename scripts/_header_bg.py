import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# ① 位置条底色：白天浅灰、夜里深靛（原来写死深色，白天很突兀）
s = s.replace("          color: const Color(0xFF1B1E28),",
              "          color: isDark ? const Color(0xFF1B1E28) : const Color(0xFFF1F5F9),", 1)

# ② 顶栏底色也跟主题走，别在白天挂一条深色
s = s.replace("""      appBar: AppBar(
        elevation: 0.5,""",
"""      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
        foregroundColor: isDark ? Colors.white : const Color(0xFF0F172A),
        elevation: 0.5,""", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('① 位置条与顶栏底色随主题')
