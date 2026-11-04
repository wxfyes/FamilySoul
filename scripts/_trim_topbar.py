import io, re
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# 删除顶部「我的世界」图标块
mw = """          // 我的世界：时辰、家底、待办、线索（只看自己那一份）
          IconButton(
            tooltip: '我的世界',
            icon: const Icon(Icons.public_rounded, size: 21),
            onPressed: () {
              HapticFeedback.lightImpact();
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => MyWorldScreen(api: provider.api),
                  fullscreenDialog: true,
                ),
              );
            },
          ),
"""
if mw in s:
    s = s.replace(mw, "", 1)
    print('① 去掉顶部"我的世界"图标')

# 删除顶部设置齿轮
gear = """          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: '服务器配置',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
"""
if gear in s:
    s = s.replace(gear, "", 1)
    print('② 去掉顶部设置齿轮')

io.open(p, 'w', encoding='utf-8').write(s)
