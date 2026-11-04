import io

p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# ① 引入抽屉用到的组件
if "out_and_about_sheet.dart" not in s:
    s = s.replace(
        "import 'my_world_screen.dart';",
        "import 'my_world_screen.dart';\nimport 'out_and_about_sheet.dart';",
        1,
    )
    print('① 引入出门抽屉')

# ② Scaffold 加 drawer
old = "    return Scaffold(\n      appBar: AppBar("
new = "    return Scaffold(\n      drawer: _buildDrawer(context, provider),\n      appBar: AppBar("
if old in s and '_buildDrawer(' not in s:
    s = s.replace(old, new, 1)
    print('② Scaffold 挂上 drawer')

# ③ 追加抽屉实现（放到 build 方法之前）
method = '''
  /// 豆包式抽屉：头像 + 位置 + 收纳所有入口（出门/世界/视讯/语音/设置）
  Widget _buildDrawer(BuildContext context, ChatProvider provider) {
    final name = provider.characterName;
    return Drawer(
      backgroundColor: const Color(0xFF15171F),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── 头部：头像 + 名字 + 此刻位置 ──
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 22, 18, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: const Color(0xFF8B5CF6),
                        child: Text(
                          name.isNotEmpty ? name.characters.first : '我',
                          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            FutureBuilder<Map<String, dynamic>?>(
                              future: provider.api.fetchMyWorld(),
                              builder: (context, snap) {
                                final self = (snap.data?['self'] is Map) ? snap.data!['self'] as Map : const {};
                                final place = (self['place'] ?? '').toString();
                                final date = (snap.data?['date'] is Map) ? snap.data!['date'] as Map : const {};
                                final day = (snap.data?['clock'] is Map) ? snap.data!['clock'] as Map : const {};
                                final txt = place.isEmpty
                                    ? '正在确认你在哪儿…'
                                    : '$place · 第${day['day'] ?? date['day'] ?? '-'}日 ${day['hour'] ?? '-'}时';
                                return Text(txt, style: const TextStyle(color: Colors.white54, fontSize: 12));
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Colors.white10),

            // ── 主入口 ──
            ListTile(
              leading: const Icon(Icons.explore_outlined, color: Color(0xFF8B5CF6)),
              title: const Text('出门 · 找人 · 赴约', style: TextStyle(color: Colors.white)),
              subtitle: const Text('去哪儿、叫谁来、赴哪个约', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
              onTap: () {
                Navigator.pop(context);
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => OutAndAboutSheet(api: provider.api),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.public_rounded, color: Colors.white70),
              title: const Text('我的世界', style: TextStyle(color: Colors.white)),
              subtitle: const Text('时辰 · 家底 · 待办 · 线索', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => MyWorldScreen(api: provider.api), fullscreenDialog: true),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.videocam_rounded, color: Color(0xFF8B5CF6)),
              title: const Text('闺房视讯', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const VideoCallScreen()));
              },
            ),
            const Divider(height: 1, color: Colors.white10),

            // ── 语音与设置 ──
            SwitchListTile(
              secondary: Icon(
                provider.isVoiceReplyEnabled ? Icons.volume_up_rounded : Icons.volume_off_rounded,
                color: provider.isVoiceReplyEnabled ? const Color(0xFF8B5CF6) : Colors.white38,
              ),
              title: const Text('语音播报', style: TextStyle(color: Colors.white)),
              subtitle: Text(
                provider.isVoiceReplyEnabled ? '开启（消耗火山额度）' : '关闭（省额度）',
                style: const TextStyle(color: Colors.white38, fontSize: 11.5),
              ),
              value: provider.isVoiceReplyEnabled,
              activeColor: const Color(0xFF8B5CF6),
              onChanged: (_) => provider.toggleVoiceReply(),
            ),
            ListTile(
              leading: const Icon(Icons.settings_outlined, color: Colors.white70),
              title: const Text('设置', style: TextStyle(color: Colors.white)),
              subtitle: const Text('服务器 · 令牌 · 备份 · 作息', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
              },
            ),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                '世界在走，不必等谁',
                style: TextStyle(color: Colors.white24, fontSize: 11.5),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }

'''
anchor = "  @override\n  Widget build(BuildContext context) {"
if anchor in s and '_buildDrawer' in s and 'FutureBuilder<Map<String, dynamic>?>' not in s:
    s = s.replace(anchor, method + anchor, 1)
    print('③ 追加抽屉实现')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
