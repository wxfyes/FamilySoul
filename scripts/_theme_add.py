import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

method = '''  /// 外观：日间 / 夜间 / 跟随系统
  void _showThemeSheet(BuildContext context) {
    final theme = context.read<ThemeController>();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSt) {
        return Container(
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
                    setSt(() {});
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
        );
      }),
    );
  }

'''
anchor = "  Widget _buildQuickActionItem({"
if '_showThemeSheet' not in s:
    s = s.replace(anchor, method + anchor, 1)
    print('③ 加 _showThemeSheet')

# 顶部胶囊：记账 → 今日
old = """                _buildTopQuickChip(
                  icon: Icons.payments_outlined,
                  label: '记一笔账',
                  isDark: isDark,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    _showPayDialog(context, provider);
                  },
                ),"""
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
                ),"""
if old in s:
    s = s.replace(old, new, 1)
    print('④ 顶部胶囊换今日')
io.open(p, 'w', encoding='utf-8').write(s)
