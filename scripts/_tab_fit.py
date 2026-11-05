import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# ① 顶部 tab 自适应：不再和右侧按钮抢位
old = """        title: Container(
          height: 32,
          padding: const EdgeInsets.all(2),"""
new = """        title: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Container(
          height: 32,
          padding: const EdgeInsets.all(2),"""
if old in s:
    s = s.replace(old, new, 1)
    # 补一层收尾括号
    s = s.replace("""          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDomainTab(0, '🌸 宿命乾坤'),
              _buildDomainTab(1, '🤖 天机助手'),
            ],
          ),
        ),""",
"""          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDomainTab(0, '🌸 宿命乾坤'),
              _buildDomainTab(1, '🤖 天机助手'),
            ],
          ),
            ),
          ),
        ),""", 1)
    print('① tab 用 FittedBox 自适应')

# ② tab 内边距略收，字号固定
s = s.replace("        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),",
              "        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),", 1)
io.open(p, 'w', encoding='utf-8').write(s)
