import io
# ① App：位置条右侧加"回家"按钮（不用搜索）
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# 状态：家名
if '_homeName' not in s:
    s = s.replace("  List<String> _hereNames = const [];",
                  "  List<String> _hereNames = const [];\n  String _homeName = '';", 1)
    print('① 状态 _homeName')

old = """      final pend = (d['pendingAction'] is Map) ? d['pendingAction'] as Map : null;"""
new = """      final homeName2 = (self['homeName'] ?? '').toString();
      final pend = (d['pendingAction'] is Map) ? d['pendingAction'] as Map : null;"""
if old in s:
    s = s.replace(old, new, 1)

old2 = """          _partyNames = names;
          _hereNames = here;
          _pendingAction = pend;"""
new2 = """          _partyNames = names;
          _hereNames = here;
          _homeName = homeName2;
          _pendingAction = pend;"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 记录家名')

# 位置条：时间之前插"回家"按钮
old3 = """                        if (_partyNames.isNotEmpty)"""
new3 = """                        if (_homeName.isNotEmpty && _placeName != _homeName)
                          Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: InkWell(
                              onTap: () async {
                                HapticFeedback.lightImpact();
                                final messenger = ScaffoldMessenger.of(context);
                                final line = await provider.api.goTo(_homeName);
                                if (!mounted) return;
                                _refreshPlace();
                                if (line != null) {
                                  messenger.showSnackBar(SnackBar(
                                    content: Text(line),
                                    duration: const Duration(milliseconds: 1800),
                                    behavior: SnackBarBehavior.floating,
                                  ));
                                }
                              },
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.home_rounded, size: 14, color: Color(0xFF8B5CF6)),
                                  SizedBox(width: 2),
                                  Text('回家', style: TextStyle(color: Color(0xFF9B8CF6), fontSize: 11.5)),
                                ],
                              ),
                            ),
                          ),
                        if (_partyNames.isNotEmpty)"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 位置条加回家按钮')
io.open(p, 'w', encoding='utf-8').write(s)
