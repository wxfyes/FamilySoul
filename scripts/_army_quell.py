import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()

# ① 读取匪患（/api/me 已返回 bandits）
if '_bandits' not in s:
    s = s.replace("  Map<String, dynamic> get _stationed =>",
                  "  List<dynamic> get _bandits => (_world?['bandits'] as List?) ?? const [];\n\n  Map<String, dynamic> get _stationed =>", 1)
    print('读取匪患列表')

# ② 在"驻军"之前插入匪患区
old = """              const SizedBox(height: 18),
              const Text('驻军', style: TextStyle(color: Colors.white54, fontSize: 12.5)),"""
new = """              if (_bandits.isNotEmpty) ...[
                const SizedBox(height: 18),
                const Text('周边匪患', style: TextStyle(color: Colors.white54, fontSize: 12.5)),
                const SizedBox(height: 8),
                Column(children: [
                  for (final b in _bandits.take(4))
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
                      ),
                      child: Row(children: [
                        const Icon(Icons.local_fire_department_rounded, size: 15, color: Color(0xFFEF4444)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${b['name'] ?? ''}', style: const TextStyle(color: Colors.white, fontSize: 13)),
                            Text('${b['homeCity'] ?? ''} · 兵力 ${b['strength'] ?? 0} · ${b['tier'] ?? 1} 阶',
                                style: const TextStyle(color: Colors.white38, fontSize: 11.5)),
                          ]),
                        ),
                        InkWell(
                          onTap: _busy ? null : () => _quell(b),
                          borderRadius: BorderRadius.circular(999),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: const Text('出征', style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 12)),
                          ),
                        ),
                      ]),
                    ),
                ]),
              ],
              const SizedBox(height: 18),
              const Text('驻军', style: TextStyle(color: Colors.white54, fontSize: 12.5)),"""
if old in s and '周边匪患' not in s:
    s = s.replace(old, new, 1)
    print('家兵面板加匪患列表与出征')

# ③ 出征方法
if 'Future<void> _quell' not in s:
    method = '''
  Future<void> _quell(dynamic b) async {
    final name = '${b['name'] ?? ''}';
    final id = '${b['id'] ?? ''}';
    int troops = 20;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSt) {
        return Container(
          decoration: const BoxDecoration(color: Color(0xFF12131A), borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 26),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('派护院出征 · $name', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text('据探报：兵力 ${b['strength'] ?? 0}，${b['tier'] ?? 1} 阶', style: const TextStyle(color: Colors.white38, fontSize: 12)),
            const SizedBox(height: 16),
            Wrap(spacing: 10, children: [
              for (final n in [10, 20, 50, 100])
                InkWell(
                  onTap: () => setSt(() => troops = n),
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
                    decoration: BoxDecoration(
                      color: troops == n ? const Color(0xFF8B5CF6).withValues(alpha: 0.22) : const Color(0xFF1A1B25),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: troops == n ? const Color(0xFF8B5CF6) : Colors.white10),
                    ),
                    child: Text('$n 人', style: TextStyle(color: troops == n ? Colors.white : Colors.white70, fontSize: 13)),
                  ),
                ),
            ]),
            const SizedBox(height: 20),
            InkWell(
              onTap: () => Navigator.pop(ctx, true),
              borderRadius: BorderRadius.circular(999),
              child: Container(
                height: 44,
                width: double.infinity,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  gradient: const LinearGradient(colors: [Color(0xFFEF4444), Color(0xFFB91C1C)]),
                ),
                child: const Text('点齐人马，出兵', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
              ),
            ),
          ]),
        );
      }),
    );
    if (ok != true) return;
    final r = await widget.api.militaryAction({'action': 'quell_bandits', 'banditId': id, 'troops': troops});
    if (!mounted) return;
    final win = r?['win'] == true;
    final text = r?['text']?.toString() ?? r?['error']?.toString() ?? '没能出兵';
    if (!mounted) return;
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(win ? '大获全胜' : '出师不利'),
        content: Text(text),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('好'))],
      ),
    );
    if (r?['ok'] == true) {
      await _load();
      widget.onChanged?.call();
    }
  }
'''
    s = s.replace("  @override\n  Widget build(BuildContext context) {", method + "\n  @override\n  Widget build(BuildContext context) {", 1)
    print('加 _quell 方法')
io.open(p, 'w', encoding='utf-8').write(s)
