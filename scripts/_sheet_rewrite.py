import io
p = 'mobile/lib/views/chat_screen.dart'
lines = io.open(p, encoding='utf-8').read().split('\n')
start = next(i for i, l in enumerate(lines) if 'void _showQuickActionSheet' in l)
end = start
while not (lines[end].strip() == '}' and (len(lines[end]) - len(lines[end].lstrip())) == 2):
    end += 1
new = '''  void _showQuickActionSheet(BuildContext context, ChatProvider provider) {
    HapticFeedback.lightImpact();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        final bg = isDark ? const Color(0xFF14161E) : Colors.white;
        final fg = isDark ? Colors.white : const Color(0xFF0F172A);
        final sub = isDark ? Colors.white38 : Colors.black45;
        final itemW = (MediaQuery.of(ctx).size.width - 40 - 36) / 4;

        Widget tile({required IconData icon, required String label, required Color color, required VoidCallback onTap}) {
          return SizedBox(
            width: itemW,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: isDark ? 0.16 : 0.12),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: color.withValues(alpha: 0.35)),
                    ),
                    child: Icon(icon, color: color, size: 24),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: fg, fontSize: 11.5),
                  ),
                ]),
              ),
            ),
          );
        }

        Widget groupTitle(String t) => Padding(
              padding: const EdgeInsets.only(left: 4, top: 4, bottom: 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(t, style: TextStyle(color: sub, fontSize: 11.5)),
              ),
            );

        return Container(
          decoration: BoxDecoration(
            color: bg,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 16, offset: const Offset(0, -4))],
          ),
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
          child: SafeArea(
            top: false,
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Center(
                child: Container(
                  width: 36, height: 4, margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(color: isDark ? Colors.white24 : Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              groupTitle('常用'),
              Wrap(spacing: 12, runSpacing: 10, children: [
                tile(
                  icon: Icons.explore_rounded, label: '转场出门', color: const Color(0xFF8B5CF6),
                  onTap: () {
                    Navigator.pop(ctx);
                    showModalBottomSheet(
                      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
                      builder: (_) => OutAndAboutSheet(api: provider.api, onChanged: _refreshPlace),
                    ).then((_) => _refreshPlace());
                  },
                ),
                tile(
                  icon: Icons.today_rounded, label: '今日看板', color: const Color(0xFFE0B252),
                  onTap: () {
                    Navigator.pop(ctx);
                    showModalBottomSheet(
                      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
                      builder: (_) => DigestSheet(api: provider.api),
                    );
                  },
                ),
                tile(
                  icon: Icons.shield_rounded, label: '随身家兵', color: const Color(0xFF10B981),
                  onTap: () {
                    Navigator.pop(ctx);
                    showModalBottomSheet(
                      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
                      builder: (_) => ArmySheet(api: provider.api, onChanged: () => setState(() {})),
                    );
                  },
                ),
                tile(
                  icon: Icons.public_rounded, label: '我的世界', color: const Color(0xFF38BDF8),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => MyWorldScreen(api: provider.api), fullscreenDialog: true),
                    );
                  },
                ),
              ]),
              groupTitle('其它'),
              Wrap(spacing: 12, runSpacing: 10, children: [
                tile(
                  icon: Icons.payments_rounded, label: '记一笔账', color: const Color(0xFF94A3B8),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showPayDialog(context, provider);
                  },
                ),
                tile(
                  icon: Icons.camera_alt_rounded, label: '拍照端详', color: const Color(0xFFEC4899),
                  onTap: () {
                    Navigator.pop(ctx);
                    _pickImage(context, provider, ImageSource.camera);
                  },
                ),
                tile(
                  icon: Icons.videocam_rounded, label: provider.isHusband ? '闺房视讯' : '面对面对聊', color: const Color(0xFFF59E0B),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await Navigator.push(context, MaterialPageRoute(builder: (_) => const VideoCallScreen()));
                  },
                ),
                tile(
                  icon: Icons.contrast_rounded, label: '外观', color: const Color(0xFFA78BFA),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showThemeSheet(context);
                  },
                ),
              ]),
            ]),
          ),
        );
      },
    );
  }
'''
lines[start:end+1] = new.split('\n')
io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('重写 + 菜单为四宫格')
