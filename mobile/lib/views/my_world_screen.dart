import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api_client.dart';

/// 我的世界：只显示"我自己"那一份
/// —— 今夕何年、我在哪、我的家底、今日待办、线索、我的难关
class MyWorldScreen extends StatefulWidget {
  const MyWorldScreen({super.key, required this.api});

  final SurfCoreApiClient api;

  @override
  State<MyWorldScreen> createState() => _MyWorldScreenState();
}

class _MyWorldScreenState extends State<MyWorldScreen> {
  Map<String, dynamic>? _data;
  List<Map<String, dynamic>> _who = const [];
  final TextEditingController _whoCtrl = TextEditingController();
  bool _loading = true;
  String? _error;

  static const _bg = Color(0xFF0F1115);
  static const _card = Color(0xFF171A21);
  static const _line = Color(0xFF242833);
  static const _accent = Color(0xFF8B5CF6);
  static const _muted = Color(0xFF8A93A6);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _whoCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadWho({String q = ''}) async {
    final rows = await widget.api.fetchWho(q: q);
    if (!mounted) return;
    setState(() => _who = rows);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    await _loadWho();
    final data = await widget.api.fetchMyWorld();
    if (!mounted) return;
    setState(() {
      _data = data;
      _loading = false;
      _error = data == null ? '连不上世界，检查一下网络' : null;
    });
  }

  String _num(dynamic v, {int digits = 0}) {
    final n = (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
    return digits == 0 ? n.toStringAsFixed(0) : n.toStringAsFixed(digits);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        titleSpacing: 8,
        title: const Text('我的世界', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            tooltip: '刷新',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loading ? null : _load,
          ),
          IconButton(
            tooltip: '关闭',
            icon: const Icon(Icons.close_rounded),
            onPressed: () {
              HapticFeedback.lightImpact();
              Navigator.of(context).maybePop();
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : _error != null
              ? _errorView()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(14, 8, 14, 28),
                    children: _buildSections(),
                  ),
                ),
    );
  }

  Widget _errorView() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, color: _muted, size: 40),
          const SizedBox(height: 10),
          Text(_error ?? '出错了', style: const TextStyle(color: _muted)),
          const SizedBox(height: 14),
          OutlinedButton(onPressed: _load, child: const Text('重试')),
        ],
      ),
    );
  }

  List<Widget> _buildSections() {
    final d = _data ?? const <String, dynamic>{};
    final self = (d['self'] as Map?)?.cast<String, dynamic>() ?? {};
    final date = (d['date'] as Map?)?.cast<String, dynamic>() ?? {};
    final assets = (d['assets'] as Map?)?.cast<String, dynamic>() ?? {};
    final todos = (d['todos'] as List?) ?? const [];
    final clues = (d['clues'] as List?) ?? const [];
    final news = (d['news'] as List?) ?? const [];
    final arc = (d['arc'] as Map?)?.cast<String, dynamic>();
    final mil = (d['military'] as Map?)?.cast<String, dynamic>();
    final standing = (d['standing'] as Map?)?.cast<String, dynamic>() ?? {};
    final props = (assets['properties'] as List?) ?? const [];

    final day = date['day'] ?? 1;
    final hour = date['hour'] ?? 0;
    final lunar = (date['lunar'] as String?) ?? '';
    final iso = (date['text'] as String?) ?? '';

    return [
      // 今天是什么日子
      _cardShell(
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [_accent.withValues(alpha: .9), _accent.withValues(alpha: .4)]),
              ),
              child: const Icon(Icons.nights_stay_rounded, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('第 $day 日 · $hour 时',
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 3),
                  Text(
                    [if (iso.isNotEmpty) iso, if (lunar.isNotEmpty) '农历$lunar'].join(' · '),
                    style: const TextStyle(color: _muted, fontSize: 12.5),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),

      // 我是谁、在哪
      _cardShell(
        child: Row(
          children: [
            const Icon(Icons.place_rounded, color: _accent, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '${self['name'] ?? ''}${(self['role'] as String?)?.isNotEmpty == true ? ' · ${self['role']}' : ''}'
                '${(self['place'] as String?)?.isNotEmpty == true ? ' · 在${self['place']}' : ''}',
                style: const TextStyle(color: Color(0xFFDDE3EE), fontSize: 13.5),
              ),
            ),
          ],
        ),
      ),

      // 家底
      _sectionTitle('家底'),
      _cardShell(
        child: Column(
          children: [
            _kv('现银', '${_num(assets['silver'], digits: 2)} 两'),
            _kv('日入', '${_num(assets['daily'], digits: 2)} 两/日'),
            if (props.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text('名下还没有产业', style: TextStyle(color: _muted, fontSize: 12.5)),
                ),
              )
            else
              for (final p in props.cast<Map>())
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text('${p['name']}',
                            style: const TextStyle(color: Color(0xFFDDE3EE), fontSize: 13)),
                      ),
                      Text(
                        '${_num(p['income'], digits: 2)} 两 · ${p['status'] ?? ''}',
                        style: const TextStyle(color: _muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
          ],
        ),
      ),

      if (mil != null) ...[
        _sectionTitle('我的人马'),
        _cardShell(
          child: Row(
            children: [
              _kvInline('护院', _num(mil['guards'])),
              _kvInline('乡勇', _num(mil['militia'])),
              _kvInline('兵马', _num(mil['army'])),
              _kvInline('粮草', '${_num(mil['supplies'])}日'),
            ],
          ),
        ),
      ],

      // 我的难关
      if (arc != null) ...[
        _sectionTitle('我的难关'),
        _cardShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${arc['title'] ?? ''}',
                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Text(
                arc['done'] == true
                    ? '已了结：${arc['outcome'] ?? ''}'
                    : (arc['atEdge'] == true
                        ? '到了最后关头——再不动，就由不得我了'
                        : ([if ((arc['step'] as String?)?.isNotEmpty == true) '眼下：${arc['step']}' else '阶段 ${(arc['stage'] ?? 0) + 1}']).join()),
                style: TextStyle(
                  color: arc['done'] == true ? const Color(0xFF7BD88F) : (arc['atEdge'] == true ? const Color(0xFFFFB86B) : _muted),
                  fontSize: 12.5,
                ),
              ),
              if (arc['done'] != true && (arc['hint'] as String?)?.isNotEmpty == true) ...[
                const SizedBox(height: 8),
                Text(
                  '${arc['hint']}',
                  style: const TextStyle(color: Color(0xFF6E7A8F), fontSize: 11.5, height: 1.5),
                ),
              ],
            ],
          ),
        ),
      ],

      // 今日待办
      _sectionTitle('待办（${todos.length}）'),
      _cardShell(
        child: todos.isEmpty
            ? const Text('眼下没有要办的事', style: TextStyle(color: _muted, fontSize: 12.5))
            : Column(
                children: [
                  for (final t in todos.cast<Map>())
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            margin: const EdgeInsets.only(top: 2),
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: (t['kind'] == '约定' ? _accent : const Color(0xFF3A4A6B)).withValues(alpha: .22),
                              borderRadius: BorderRadius.circular(5),
                            ),
                            child: Text('${t['kind']}',
                                style: const TextStyle(fontSize: 10.5, color: Color(0xFFC9D2E3))),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text('${t['text']}',
                                style: const TextStyle(color: Color(0xFFDDE3EE), fontSize: 12.5, height: 1.45)),
                          ),
                          if (t['day'] != null)
                            Text(
                              t['overdue'] == true ? '逾期' : '第${t['day']}日',
                              style: TextStyle(
                                color: t['overdue'] == true ? const Color(0xFFFF7A7A) : _muted,
                                fontSize: 11,
                                fontWeight: t['overdue'] == true ? FontWeight.w600 : FontWeight.normal,
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
      ),

      // 世界新闻
      if (news.isNotEmpty) ...[
        if ((d['decrees'] as List?)?.isNotEmpty == true) ...[
        _sectionTitle('朝廷旨意'),
        _cardShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final dec in (d['decrees'] as List))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('第${dec['day']}日', style: const TextStyle(color: _muted, fontSize: 11.5)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '「${dec['text'] ?? ''}」',
                          style: const TextStyle(color: Color(0xFFE7D9A8), fontSize: 12.5, height: 1.5),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],

      _sectionTitle('世界动静'),
        _cardShell(
          child: Column(
            children: [
              for (final e in news)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.bolt_rounded, size: 13, color: Color(0xFF7C8BA1)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text('${e['text']}',
                            style: const TextStyle(color: Color(0xFFDDE3EE), fontSize: 12.5, height: 1.45)),
                      ),
                      if (e['day'] != null)
                        Text('第${e['day']}日', style: const TextStyle(color: _muted, fontSize: 10.5)),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],

      // 线索
      if (clues.isNotEmpty) ...[
        _sectionTitle('线索'),
        _cardShell(
          child: Column(
            children: [
              for (final c in clues.cast<Map>())
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.circle, size: 5, color: _accent),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text('${c['text']}',
                            style: const TextStyle(color: Color(0xFFDDE3EE), fontSize: 12.5, height: 1.45)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],

      // 行踪：谁在哪
      _sectionTitle('行踪（谁在哪）'),
      _cardShell(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _whoCtrl,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: '搜名字或身份（默认只显示相识的人）',
                      hintStyle: const TextStyle(color: _muted, fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF1B2029),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    onSubmitted: (v) => _loadWho(q: v.trim()),
                  ),
                ),
                const SizedBox(width: 8),
                TextButton(onPressed: () => _loadWho(q: _whoCtrl.text.trim()), child: const Text('查')),
              ],
            ),
            const SizedBox(height: 6),
            if (_who.isEmpty)
              const Text('没找到人', style: TextStyle(color: _muted, fontSize: 12.5))
            else
              for (final w in _who)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    children: [
                      if (w['here'] == true)
                        const Padding(
                          padding: EdgeInsets.only(right: 4),
                          child: Icon(Icons.place, size: 13, color: Color(0xFF7BD88F)),
                        ),
                      Expanded(
                        child: Text(
                          '${w['name']}  ${w['role'] ?? ''}${w['human'] == true ? '  · 真人' : ''}',
                          style: const TextStyle(color: Color(0xFFDDE3EE), fontSize: 12.5),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text('${w['place'] ?? ''}', style: const TextStyle(color: _muted, fontSize: 11.5)),
                    ],
                  ),
                ),
          ],
        ),
      ),

      // 名声
      _sectionTitle('名声'),
      _cardShell(
        child: Row(
          children: [
            _kvInline('士绅口碑', _num(standing['reputation'])),
            _kvInline('官府通缉', _num(standing['wanted'])),
          ],
        ),
      ),
    ];
  }

  Widget _sectionTitle(String text) => Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 8, left: 2),
        child: Text(text, style: const TextStyle(color: _muted, fontSize: 12.5, fontWeight: FontWeight.w600)),
      );

  Widget _cardShell({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: _card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _line),
        ),
        child: child,
      );

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            Text(k, style: const TextStyle(color: _muted, fontSize: 12.5)),
            const Spacer(),
            Text(v, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
          ],
        ),
      );

  Widget _kvInline(String k, String v) => Expanded(
        child: Column(
          children: [
            Text(v, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(k, style: const TextStyle(color: _muted, fontSize: 11)),
          ],
        ),
      );
}
