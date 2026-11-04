import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api_client.dart';

/// 出门 · 找人 · 赴约 —— 底部抽屉（三个 tab，点一下就执行）
/// 走的是服务端同一套管道（/api/world/menu|go|summon|todo），不碰聊天逻辑。
class OutAndAboutSheet extends StatefulWidget {
  const OutAndAboutSheet({super.key, required this.api, this.onChanged});

  final SurfCoreApiClient api;
  final VoidCallback? onChanged;

  @override
  State<OutAndAboutSheet> createState() => _OutAndAboutSheetState();
}

class _OutAndAboutSheetState extends State<OutAndAboutSheet> with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 3, vsync: this);
  Map<String, dynamic>? _menu;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final d = await widget.api.fetchMenu();
    if (!mounted) return;
    setState(() {
      _menu = d;
      _loading = false;
    });
  }

  Future<void> _run(Future<bool> Function() action, String okText) async {
    if (_busy) return;
    setState(() => _busy = true);
    HapticFeedback.lightImpact();
    final ok = await action();
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(okText), duration: const Duration(milliseconds: 1200), behavior: SnackBarBehavior.floating),
      );
      widget.onChanged?.call();
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _menu;
    final where = (d?['where'] is Map) ? (d!['where'] as Map)['name']?.toString() ?? '' : '';
    final clock = (d?['clock'] is Map) ? d!['clock'] as Map : const {};
    return SafeArea(
      child: Container(
        height: MediaQuery.of(context).size.height * 0.62,
        padding: const EdgeInsets.only(top: 10),
        decoration: const BoxDecoration(
          color: Color(0xFF11131A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
        ),
        child: Column(
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const Icon(Icons.explore_outlined, size: 18, color: Color(0xFF8B5CF6)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      where.isEmpty ? '出门 · 找人 · 赴约' : '你在「$where」 · 第${clock['day'] ?? '-'}日 ${clock['hour'] ?? '-'}时',
                      style: const TextStyle(fontSize: 13.5, color: Colors.white70),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    onPressed: _load,
                    tooltip: '刷新',
                  ),
                ],
              ),
            ),
            TabBar(
              controller: _tab,
              labelColor: const Color(0xFF8B5CF6),
              unselectedLabelColor: Colors.white54,
              indicatorColor: const Color(0xFF8B5CF6),
              tabs: const [Tab(text: '去哪儿'), Tab(text: '找人'), Tab(text: '待办')],
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                  : TabBarView(
                      controller: _tab,
                      children: [
                        _places(d),
                        _people(d),
                        _todos(d),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _places(Map<String, dynamic>? d) {
    final places = (d?['places'] as List?) ?? const [];
    final homes = (d?['homes'] as List?) ?? const [];
    if (places.isEmpty && homes.isEmpty) {
      return const Center(child: Text('附近没什么地方可去', style: TextStyle(color: Colors.white54)));
    }
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      children: [
        if (homes.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 6, top: 2),
            child: Text('我的产业', style: TextStyle(fontSize: 12, color: Colors.white38)),
          ),
          ...homes.map((h) => _row(
                title: (h['name'] ?? '').toString(),
                subtitle: '日入 ${h['income'] ?? 0} 两',
                action: TextButton(
                  onPressed: () => _run(() => widget.api.goTo((h['name'] ?? '').toString()), '（你走到了「${h['name']}」。）'),
                  child: const Text('过去'),
                ),
              )),
          const SizedBox(height: 6),
        ],
        if (places.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 6, top: 6),
            child: Text('有人气的地方', style: TextStyle(fontSize: 12, color: Colors.white38)),
          ),
          ...places.map((p) => _row(
                title: (p['name'] ?? '').toString(),
                subtitle: ((p['names'] as List?) ?? const []).join('、'),
                action: TextButton(
                  onPressed: () => _run(() => widget.api.goTo((p['name'] ?? '').toString()), '（你走到了「${p['name']}」。）'),
                  child: const Text('过去'),
                ),
              )),
        ],
      ],
    );
  }

  Widget _people(Map<String, dynamic>? d) {
    final people = (d?['people'] as List?) ?? const [];
    if (people.isEmpty) {
      return const Center(child: Text('世上没别人', style: TextStyle(color: Colors.white54)));
    }
    final groups = <String, List>{};
    for (final p in people) {
      final g = (p['group'] ?? '其他人').toString();
      groups.putIfAbsent(g, () => []).add(p);
    }
    // 按服务端给的视角分组渲染（相公：府内/相好/其他人；她：我的人/王家/其他人）
    final order = ['我的人', '府内', '王家', '相好', '其他人'];
    final names = groups.keys.toList()
      ..sort((a, b) {
        final ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    final children = <Widget>[];
    for (final g in names) {
      final list = groups[g];
      if (list == null || list.isEmpty) continue;
      children.add(Padding(
        padding: const EdgeInsets.only(left: 4, top: 8, bottom: 4),
        child: Text(g, style: const TextStyle(fontSize: 12, color: Colors.white38)),
      ));
      for (final p in list.take(g == '其他人' ? 8 : 12)) {
        final here = p['here'] == true;
        final canSummon = p['canSummon'] != false;
        final isMale = (p['gender'] ?? '') == 'male';
        final he = isMale ? '他' : '她';
        final placeName = (p['place'] ?? '').toString();
        children.add(_row(
          title: (p['name'] ?? '').toString(),
          subtitle: '${p['role'] ?? ''} · ${here ? '就在跟前' : placeName}',
          action: here
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text('在场', style: TextStyle(fontSize: 12, color: Color(0xFF22C55E))),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // 过去找她/他
                    TextButton(
                      onPressed: placeName.isEmpty
                          ? null
                          : () => _run(() => widget.api.goTo(placeName), '（你去找${p['name']}了。）'),
                      child: Text('去$he这'),
                    ),
                    // 叫她/他来（真人不给这个）
                    if (canSummon)
                      TextButton(
                        onPressed: () => _run(() => widget.api.summon((p['id'] ?? '').toString()), '（${p['name']}应声赶来。）'),
                        child: Text('叫$he来'),
                      ),
                  ],
                ),
        ));
      }
    }
    return ListView(padding: const EdgeInsets.symmetric(horizontal: 12), children: children);
  }

  Widget _todos(Map<String, dynamic>? d) {
    final todos = (d?['todos'] as List?) ?? const [];
    if (todos.isEmpty) {
      return const Center(child: Text('没有约定与承诺', style: TextStyle(color: Colors.white54)));
    }
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      children: todos.map((x) {
        final isApt = (x['kind'] ?? '') == '约定';
        return _row(
          title: '${x['kind']} · ${x['when'] ?? ''} ${x['who'] ?? ''}',
          subtitle: (x['text'] ?? '').toString(),
          action: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isApt)
                TextButton(
                  onPressed: () => _run(() => widget.api.todoAction((x['id'] ?? '').toString(), 'go'), '（你去赴约了。）'),
                  child: const Text('赴约'),
                ),
              TextButton(
                onPressed: () => _run(() => widget.api.todoAction((x['id'] ?? '').toString(), 'drop'), '（这件事先搁下了。）'),
                child: const Text('取消', style: TextStyle(color: Colors.white38)),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _row({required String title, required String subtitle, required Widget action}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.only(left: 12, right: 4, top: 6, bottom: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 14, color: Colors.white)),
                if (subtitle.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(subtitle, style: const TextStyle(fontSize: 11.5, color: Colors.white38), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
              ],
            ),
          ),
          action,
        ],
      ),
    );
  }
}

