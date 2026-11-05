import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# ① + 号菜单里补上「今日看板」「外观」
old = """                    _buildQuickActionItem(
                      icon: Icons.public_rounded,
                      label: '我的世界',
                      color: const Color(0xFF38BDF8),"""
new = """                    _buildQuickActionItem(
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
                    _buildQuickActionItem(
                      icon: Icons.public_rounded,
                      label: '我的世界',
                      color: const Color(0xFF38BDF8),"""
if old in s and "label: '今日看板'" not in s.split('_buildQuickActionItem')[0]:
    s = s.replace(old, new, 1)
    print('① + 菜单加今日/外观')

# ② 抽一个外观弹层方法，抽屉与+菜单共用
if 'void _showThemeSheet(' not in s:
    anchor = "  Widget _buildQuickActionItem({"
    method = """  /// 外观：日间 / 夜间 / 跟随系统
  void _showThemeSheet(BuildContext context) {
    final theme = context.read<ThemeController>();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF12131A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 26),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          const Text('外观模式', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 14),
          for (final m in [ThemeMode.system, ThemeMode.light, ThemeMode.dark])
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                onTap: () async {
                  await theme.setMode(m);
                  if (ctx.mounted) Navigator.pop(ctx);
                },
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                  decoration: BoxDecoration(
                    color: theme.mode == m ? const Color(0xFF8B5CF6).withValues(alpha: 0.18) : const Color(0xFF1A1B25),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: theme.mode == m ? const Color(0xFF8B5CF6) : Colors.white10),
                  ),
                  child: Row(children: [
                    Icon(
                      m == ThemeMode.system ? Icons.brightness_auto_rounded : (m == ThemeMode.light ? Icons.light_mode_rounded : Icons.dark_mode_rounded),
                      size: 18,
                      color: theme.mode == m ? Colors.white : Colors.white54,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      m == ThemeMode.system ? '跟随系统' : (m == ThemeMode.light ? '日间' : '夜间'),
                      style: TextStyle(color: theme.mode == m ? Colors.white : Colors.white70, fontSize: 14),
                    ),
                    const Spacer(),
                    if (theme.mode == m) const Icon(Icons.check_rounded, size: 18, color: Color(0xFF8B5CF6)),
                  ]),
                ),
              ),
            ),
        ]),
      ),
    );
  }

""" + anchor
    s = s.replace(anchor, method, 1)
    print('② 抽 _showThemeSheet')
io.open(p, 'w', encoding='utf-8').write(s)
