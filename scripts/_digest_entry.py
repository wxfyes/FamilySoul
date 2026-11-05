import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# ① 顶部胶囊：去掉重复的"记一笔账"（+号菜单里已有），换成"今日"
old = """                _buildTopQuickChip(
                  icon: Icons.payments_outlined,
                  label: '记一笔账',
                  isDark: isDark,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    _showPayDialog(context, provider);
                  },
                ),
                const SizedBox(width: 8),"""
new = """                _buildTopQuickChip(
                  icon: Icons.today_outlined,
                  label: '今日',
                  isDark: isDark,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => DigestSheet(api: provider.api),
                    );
                  },
                ),
                const SizedBox(width: 8),"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 顶部胶囊：记账换今日')

# ② 抽屉加"今日看板"
old2 = """            ListTile(
              leading: const Icon(Icons.public_rounded, color: Colors.white70),
              title: const Text('我的世界', style: TextStyle(color: Colors.white)),"""
new2 = """            ListTile(
              leading: const Icon(Icons.today_rounded, color: Color(0xFFE0B252)),
              title: const Text('今日看板', style: TextStyle(color: Colors.white)),
              subtitle: const Text('天气 · 家中 · 今日事 · 大事记', style: TextStyle(color: Colors.white38, fontSize: 12)),
              onTap: () {
                Navigator.pop(context);
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => DigestSheet(api: provider.api),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.public_rounded, color: Colors.white70),
              title: const Text('我的世界', style: TextStyle(color: Colors.white)),"""
if old2 in s and '今日看板' not in s:
    s = s.replace(old2, new2, 1)
    print('② 抽屉加今日看板')

# ③ 引入
if 'digest_sheet.dart' not in s:
    s = s.replace("import 'army_sheet.dart';", "import 'army_sheet.dart';\nimport 'digest_sheet.dart';", 1)
    if 'digest_sheet.dart' not in s:
        s = s.replace("import 'out_and_about_sheet.dart';", "import 'out_and_about_sheet.dart';\nimport 'digest_sheet.dart';", 1)
    print('③ 引入 DigestSheet')
io.open(p, 'w', encoding='utf-8').write(s)
