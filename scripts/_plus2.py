import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# ① 导入
if 'digest_sheet.dart' not in s:
    s = s.replace("import '../services/offline_asr_service.dart';",
                  "import '../services/offline_asr_service.dart';\nimport '../services/theme_controller.dart';\nimport 'digest_sheet.dart';", 1)
    print('① 导入 digest/theme')

# ② + 菜单补两项
anchor = """                    _buildQuickActionItem(
                      icon: Icons.public_rounded,
                      label: '我的世界',"""
add = """                    _buildQuickActionItem(
                      icon: Icons.today_rounded,
                      label: '今日看板',
                      color: const Color(0xFFE0B252),
                      onTap: () {
                        Navigator.pop(ctx);
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => DigestSheet(api: provider.api),
                        );
                      },
                    ),
                    _buildQuickActionItem(
                      icon: Icons.contrast_rounded,
                      label: '外观',
                      color: const Color(0xFF94A3B8),
                      onTap: () {
                        Navigator.pop(ctx);
                        _showThemeSheet(context);
                      },
                    ),
""" + anchor
if "label: '今日看板'" not in s:
    s = s.replace(anchor, add, 1)
    print('② + 菜单加今日/外观')
io.open(p, 'w', encoding='utf-8').write(s)
