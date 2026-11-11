import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api_client.dart';
import 'roster_screen.dart';
import 'army_sheet.dart';

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
  bool _loading = true;
  String? _error;

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;
  Color get _bg => _isDark ? const Color(0xFF0F1115) : const Color(0xFFF1F5F9);
  Color get _card => _isDark ? const Color(0xFF171A21) : Colors.white;
  Color get _line => _isDark ? const Color(0xFF242833) : const Color(0xFFE2E8F0);
  Color get _accent => const Color(0xFF8B5CF6);
  Color get _muted => _isDark ? const Color(0xFF8A93A6) : const Color(0xFF64748B);
  Color get _textPrimary => _isDark ? Colors.white : const Color(0xFF0F172A);
  Color get _textSecondary => _isDark ? const Color(0xFFDDE3EE) : const Color(0xFF334155);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final d = await widget.api.fetchMyWorld();
    if (!mounted) return;
    if (d == null) {
      setState(() {
        _loading = false;
        _error = '未连上，稍后再试';
      });
      return;
    }
    setState(() {
      _data = d;
      _loading = false;
    });
    // 首次载入后顺便拉一下当前地点有哪些人
    final self = (d['self'] as Map?)?.cast<String, dynamic>();
    if (self?['place'] != null) {
      _loadWho(loc: self!['place'].toString());
    }
  }

  List<Map<String, dynamic>> _who = [];
  final TextEditingController _whoCtrl = TextEditingController();
  Future<void> _loadWho({String? q, String? loc}) async {
    final list = await widget.api.fetchWho(q: q ?? '');
    if (!mounted) return;
    setState(() => _who = list);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        titleSpacing: 14,
        iconTheme: IconThemeData(color: _textPrimary),
        title: Text(
          '我的世界',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: _textPrimary,
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 6),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.05),
            ),
            child: IconButton(
              tooltip: '刷新',
              icon: Icon(Icons.refresh_rounded, size: 20, color: _textPrimary),
              onPressed: _loading ? null : _load,
            ),
          ),
          Container(
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isDark ? Colors.white.withValues(alpha: 0.16) : Colors.black.withValues(alpha: 0.08),
            ),
            child: IconButton(
              tooltip: '关闭',
              icon: Icon(Icons.close_rounded, size: 20, color: _textPrimary),
              onPressed: () {
                HapticFeedback.lightImpact();
                Navigator.of(context).maybePop();
              },
            ),
          ),
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
          Icon(Icons.cloud_off_rounded, color: _muted, size: 40),
          const SizedBox(height: 10),
          Text(_error ?? '出错了', style: TextStyle(color: _muted)),
          const SizedBox(height: 14),
          OutlinedButton(onPressed: _load, child: const Text('重试')),
        ],
      ),
    );
  }

  List<Widget> _buildSections() {
    final d = _data ?? const <String, dynamic>{};
    final self = (d['self'] as Map?)?.cast<String, dynamic>() ?? {};
    final isHusband = self['isHusband'] == true;
    final date = (d['date'] as Map?)?.cast<String, dynamic>() ?? {};
    final assets = (d['assets'] as Map?)?.cast<String, dynamic>() ?? {};
    final todos = (d['todos'] as List?) ?? const [];
    final clues = (d['clues'] as List?) ?? const [];
    final news = (d['news'] as List?) ?? const [];
    final daily = (d['daily'] as List?) ?? const [];
    final arc = (d['arc'] as Map?)?.cast<String, dynamic>();
    final mil = (d['military'] as Map?)?.cast<String, dynamic>();
    final standing = (d['standing'] as Map?)?.cast<String, dynamic>() ?? {};
    final props = (assets['properties'] as List?) ?? const [];
    final householdMap = (d['household'] as Map?)?.cast<String, dynamic>();
    final household = householdMap ?? const <String, dynamic>{};
    final hhAllowance = (household['allowance'] as num?)?.toDouble() ?? 4.0;
    final hhArrears = (household['arrears'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final hhMonths = (hhArrears['months'] as num?)?.toInt() ?? 0;
    final hhOwed = (hhArrears['owed'] as num?)?.toDouble() ?? 0;
    final married = (self['married'] as String?) ?? '';
    final spouseName = (self['spouseName'] as String?) ?? '';

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
                      style: TextStyle(color: _textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 3),
                  Text(
                    [if (iso.isNotEmpty) iso, if (lunar.isNotEmpty) '农历$lunar'].join(' · '),
                    style: TextStyle(color: _muted, fontSize: 12.5),
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
            Icon(Icons.place_rounded, color: _accent, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '${self['name'] ?? ''}${(self['role'] as String?)?.isNotEmpty == true ? ' · ${self['role']}' : ''}'
                '${(self['place'] as String?)?.isNotEmpty == true ? ' · 在${self['place']}' : ''}',
                style: TextStyle(color: _textSecondary, fontSize: 13.5),
              ),
            ),
          ],
        ),
      ),

      // 名分与住处
      _sectionTitle('名分与住处'),
      _cardShell(
        child: Column(
          children: [
            _kv('名分', () {
              // 彻底动态化：优先从服务端 marriages 下发（包含正妻沈婉儿、二房林芸娘、妾室小翠、侧室崔婉宁等全量名单）
              final marriages = (d['marriages'] as List?) ?? (d['wives'] as List?) ?? (self['wives'] as List?);
              if (marriages != null && marriages.isNotEmpty) {
                return marriages.map((w) {
                  if (w is Map) return '${w['role'] ?? '侧室'}：${w['name'] ?? ''}';
                  return w.toString();
                }).join('；');
              }
              if (spouseName.isNotEmpty) return '$married · 配偶「$spouseName」';
              return married.isNotEmpty ? married : '府内良人';
            }()),
            _kv('住处', () {
              final h = (self['homeName'] as String?) ??
                  (d['homeName'] as String?) ??
                  (self['residence'] as String?) ??
                  (self['home'] as String?) ??
                  '';
              return h.isNotEmpty ? h : '临江·王宅·正房';
            }()),
          ],
        ),
      ),

      // 二级卡片直通看板：世情羁绊 / 江山兵符 / 庙堂朝政（按账号权限隔离）
      _sectionTitle('天下格局与世情志'),

      // 1. 城中世情名录入口（全员可见）
      _cardShell(
        child: InkWell(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => RosterScreen(api: widget.api)),
            );
          },
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _isDark ? const Color(0xFF2E1065) : const Color(0xFFF3E8FF),
                ),
                child: const Icon(Icons.favorite_rounded, color: Color(0xFFF472B6), size: 19),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('城中世情志 · 人物好感名录',
                        style: TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text('分地区查阅全城人物 · 信任欲望怨怼心性与态度评语',
                        style: TextStyle(color: _muted, fontSize: 11.5)),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_ios_rounded, color: _muted, size: 14),
            ],
          ),
        ),
      ),

      // 2. 江山兵符 · 势力与天下城池（仅主公/相公账号可见，普通妻妾账号隔离隐藏）
      if (isHusband) ...[
        const SizedBox(height: 8),
        _cardShell(
          child: InkWell(
            onTap: () {
              showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => ArmySheet(
                  api: widget.api,
                  onChanged: () => setState(() {}),
                ),
              );
            },
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isDark ? const Color(0xFF064E3B) : const Color(0xFFDCFCE7),
                  ),
                  child: const Icon(Icons.shield_rounded, color: Color(0xFF10B981), size: 19),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('江山兵符 · 势力与天下城池',
                          style: TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text('各城驻防部署 · 私兵护院家丁统御与武勋晋升',
                          style: TextStyle(color: _muted, fontSize: 11.5)),
                    ],
                  ),
                ),
                Icon(Icons.arrow_forward_ios_rounded, color: _muted, size: 14),
              ],
            ),
          ),
        ),
      ],

      // 3. 庙堂朝政 · 圣谕与天下父母官（仅主公/相公账号可见，普通妻妾账号隔离隐藏）
      if (isHusband) ...[
        const SizedBox(height: 8),
        _cardShell(
          child: InkWell(
            onTap: () => _showCourtSheet(context, d),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isDark ? const Color(0xFF78350F) : const Color(0xFFFEF3C7),
                  ),
                  child: const Icon(Icons.account_balance_rounded, color: Color(0xFFF59E0B), size: 19),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('庙堂朝政 · 圣谕与天下父母官',
                          style: TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text('京城圣谕敕令 · 各府父母官与文武品级评定',
                          style: TextStyle(color: _muted, fontSize: 11.5)),
                    ],
                  ),
                ),
                Icon(Icons.arrow_forward_ios_rounded, color: _muted, size: 14),
              ],
            ),
          ),
        ),
      ],

      // 我这一日（只有自己的事）
      if (daily.isNotEmpty) ...[
        _sectionTitle('我这一日'),
        _cardShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final g in daily.cast<Map>())
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text('${g['name']}',
                              style: TextStyle(color: _textPrimary, fontSize: 13.5, fontWeight: FontWeight.w600)),
                          const SizedBox(width: 6),
                          if ('${g['place'] ?? ''}'.isNotEmpty)
                            Text('在${g['place']}',
                                style: TextStyle(color: _muted, fontSize: 11.5)),
                        ],
                      ),
                      for (final line in ((g['lines'] as List?) ?? const []))
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text('· $line',
                              style: TextStyle(color: _textSecondary, fontSize: 12.5, height: 1.35)),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],

      // 家底
      _sectionTitle('家底'),
      _cardShell(
        child: Column(
          children: [
            _kv('现银', '${_num(assets['silver'], digits: 2)} 两'),
            _kv('日入', '${_num(assets['daily'], digits: 2)} 两/日'),
            if (householdMap != null && hhAllowance > 0)
              _kv('中馈月例', '${hhAllowance.toStringAsFixed(1)} 两/月'),
            if (hhMonths > 0)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(children: [
                  Expanded(
                    child: Text('中馈欠拨 $hhMonths 月，共 ${hhOwed.toStringAsFixed(1)} 两',
                        style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 12.5)),
                  ),
                  InkWell(
                    onTap: () async {
                      final r = await widget.api.householdPay();
                      if (!mounted) return;
                      final ok = r?['ok'] == true;
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(ok ? (r?['text']?.toString() ?? '已补发') : (r?['error']?.toString() ?? '没办成')),
                        behavior: SnackBarBehavior.floating,
                        duration: const Duration(milliseconds: 1600),
                      ));
                      if (ok) setState(() {});
                    },
                    borderRadius: BorderRadius.circular(999),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text('补发中馈', style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 12)),
                    ),
                  ),
                ]),
              ),
            if (props.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
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
                            style: TextStyle(color: _textSecondary, fontSize: 13)),
                      ),
                      Text(
                        '${_num(p['income'], digits: 2)} 两 · ${p['status'] ?? ''}',
                        style: TextStyle(color: _muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
          ],
        ),
      ),

      // 家中（生老病死）
      if ((d['life'] as Map?) != null) ...[
        _sectionTitle('家中'),
        _cardShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if ((d['life'] as Map)['age'] != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text('你今年 ${(d['life'] as Map)['age']} 岁'
                    '${(d['life'] as Map)['pregnant'] == true ? '　·　身怀六甲（${(d['life'] as Map)['pregnancyDays']} 天）' : ''}',
                    style: TextStyle(color: _textSecondary, fontSize: 12.5)),
                ),
              for (final h in ((d['life'] as Map)['house'] as List? ?? []))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Expanded(child: Text('${h['name']}  ${h['role'] ?? ''}', style: TextStyle(color: _textSecondary, fontSize: 12))),
                      Text(
                        '${h['age'] != null ? '${h['age']}岁' : ''}${h['pregnant'] == true ? '　有孕 ${h['days']}天' : ''}',
                        style: TextStyle(color: _muted, fontSize: 11.5),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],

      if (mil != null) ...[
        _sectionTitle('我的人马'),
        _cardShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _kvInline('私兵', _num(mil['troops'] ?? mil['army'] ?? 0)),
                  _kvInline('护院', _num(mil['retainers'] ?? mil['guards'] ?? 0)),
                  _kvInline('家丁', _num(mil['houseGuards'] ?? mil['servants'] ?? 0)),
                  if (mil['supplies'] != null || mil['grain'] != null)
                    _kvInline('粮草', '${_num(mil['supplies'] ?? mil['grain'])}石'),
                ],
              ),
              if (mil['kinds'] is Map)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    '兵种分列：${(mil['kinds'] as Map).entries.map((e) => '${_troopKindName(e.key.toString())}: ${e.value}人').join(' · ')}',
                    style: TextStyle(color: _muted, fontSize: 11.5),
                  ),
                ),
            ],
          ),
        ),
      ],

      // 随身物产 · 契纸字据
      if ((d['items'] as List?)?.isNotEmpty == true) ...[
        _sectionTitle('随身物产 · 契据字据（${(d['items'] as List).length}）'),
        _cardShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final it in (d['items'] as List).cast<Map>())
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE0B252).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          it['kind']?.toString() ?? '契纸',
                          style: const TextStyle(color: Color(0xFFE0B252), fontSize: 11),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          it['name']?.toString() ?? '',
                          style: TextStyle(color: _textSecondary, fontSize: 13),
                        ),
                      ),
                      if (it['holder'] != null || it['owner'] != null)
                        Text(
                          '${it['holder'] ?? it['owner']}',
                          style: TextStyle(color: _muted, fontSize: 11.5),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],

      // 四方动向 · 境外匪患
      if ((d['bandits'] as List?)?.isNotEmpty == true) ...[
        _sectionTitle('四方动向 · 境外匪患'),
        _cardShell(
          child: Column(
            children: [
              for (final b in (d['bandits'] as List).cast<Map>())
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      const Icon(Icons.shield_outlined, size: 16, color: Color(0xFFFCA5A5)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          b['name']?.toString() ?? '散匪',
                          style: TextStyle(color: _textSecondary, fontSize: 13),
                        ),
                      ),
                      Text(
                        '兵力 ${b['strength'] ?? 0}${b['tier'] != null ? ' · ${b['tier']}阶' : ''}',
                        style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 12),
                      ),
                    ],
                  ),
                ),
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
                  style: TextStyle(color: _textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
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
                  style: TextStyle(color: _muted, fontSize: 11.5, height: 1.5),
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
            ? Text('眼下没有要办的事', style: TextStyle(color: _muted, fontSize: 12.5))
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
                                style: TextStyle(color: _textSecondary, fontSize: 12.5, height: 1.45)),
                          ),
                          if (t['day'] != null)
                            Text(
                              t['overdue'] == true ? '逾期' : '第${t['day']}日',
                              style: TextStyle(
                                color: t['overdue'] == true ? const Color(0xFFFF7A7A) : _muted,
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
      ),

      // 心头线索
      if (clues.isNotEmpty) ...[
        _sectionTitle('心头线索（${clues.length}）'),
        _cardShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final c in clues.cast<Map>())
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 4, right: 6),
                        child: Icon(Icons.circle, size: 5, color: _accent),
                      ),
                      Expanded(
                        child: Text('${c['text']}',
                            style: TextStyle(color: _textSecondary, fontSize: 12.5, height: 1.35)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],

      // 近日听闻
      if (news.isNotEmpty) ...[
        _sectionTitle('近日听闻'),
        _cardShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final n in news.cast<Map>())
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(top: 4, right: 6),
                        child: Icon(Icons.circle, size: 5, color: Color(0xFFF59E0B)),
                      ),
                      Expanded(
                        child: Text('${n['text']}',
                            style: TextStyle(color: _textSecondary, fontSize: 12.5, height: 1.35)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],

      // 查身边的人
      _sectionTitle('查人物'),
      _cardShell(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _whoCtrl,
                    style: TextStyle(color: _textPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: '搜名字或身份（默认只显示相识的人）',
                      hintStyle: TextStyle(color: _muted, fontSize: 12),
                      filled: true,
                      fillColor: _isDark ? const Color(0xFF1B2029) : const Color(0xFFF8FAFC),
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
              Text('没找到人', style: TextStyle(color: _muted, fontSize: 12.5))
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
                          style: TextStyle(color: _textSecondary, fontSize: 12.5),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text('${w['place'] ?? ''}', style: TextStyle(color: _muted, fontSize: 11.5)),
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

  String _troopKindName(String key) {
    switch (key.toLowerCase()) {
      case 'guard':
        return '甲兵';
      case 'retainer':
        return '精锐';
      case 'army':
        return '战卒';
      case 'militia':
        return '乡勇';
      case 'cavalry':
        return '铁骑';
      case 'archer':
        return '弓弩手';
      case 'scout':
        return '斥候';
      case 'escort':
        return '镖师';
      default:
        return key;
    }
  }

  void _showCourtSheet(BuildContext context, Map<String, dynamic> d) {
    final decrees = (d['decrees'] as List?) ?? const [];
    final offices = (d['offices'] as List?) ?? const [];
    Map<String, dynamic>? yamen;

    final rawFactions = d['factions'];
    if (rawFactions is List) {
      for (final f in rawFactions) {
        if (f is Map) {
          final fid = f['id']?.toString() ?? '';
          if (fid == 'yamen' || fid == 'court') {
            yamen = f.cast<String, dynamic>();
            break;
          }
        }
      }
    } else if (rawFactions is Map) {
      yamen = (rawFactions['yamen'] as Map?)?.cast<String, dynamic>() ??
              (rawFactions['court'] as Map?)?.cast<String, dynamic>();
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          height: MediaQuery.of(ctx).size.height * 0.78,
          decoration: BoxDecoration(
            color: _bg,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 8, bottom: 12),
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: _isDark ? Colors.white24 : Colors.black12,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _isDark ? const Color(0xFF78350F) : const Color(0xFFFEF3C7),
                        ),
                        child: const Icon(Icons.account_balance_rounded, size: 20, color: Color(0xFFF59E0B)),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        '庙堂朝政 · 圣谕与天下父母官',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: _textPrimary,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: Icon(Icons.close_rounded, color: _muted),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // 圣谕敕令
                      _sectionTitle('📜 朝廷明降圣谕'),
                      if (decrees.isEmpty)
                        _cardShell(child: Text('近期朝廷无特颁大典圣谕。', style: TextStyle(color: _muted, fontSize: 13)))
                      else
                        for (final dec in decrees)
                          Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: _isDark ? const Color(0xFF1E1B18) : const Color(0xFFFFFBEB),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Text('【天子明诏】', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 12, fontWeight: FontWeight.bold)),
                                    const Spacer(),
                                    if (dec is Map && dec['day'] != null)
                                      Text('第${dec['day']}日奉旨', style: TextStyle(color: _muted, fontSize: 11)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  dec is Map ? (dec['text']?.toString() ?? '') : dec.toString(),
                                  style: TextStyle(color: _textPrimary, fontSize: 13, height: 1.4),
                                ),
                              ],
                            ),
                          ),

                      const SizedBox(height: 12),
                      // 天下父母官与官阶品级
                      _sectionTitle('🏛️ 天下父母官与仕宦品级'),
                      if (offices.isEmpty && yamen == null)
                        _cardShell(child: Text('天下官员录尚在吏部誊抄。', style: TextStyle(color: _muted, fontSize: 13)))
                      else ...[
                        if (yamen != null)
                          _cardShell(
                            child: Row(
                              children: [
                                const Icon(Icons.badge_outlined, color: Color(0xFF38BDF8), size: 20),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('${yamen['name'] ?? '临江府衙'}', style: TextStyle(color: _textPrimary, fontSize: 13.5, fontWeight: FontWeight.bold)),
                                      const SizedBox(height: 2),
                                      Text('势力威信: ${yamen['power'] ?? 50} · 与王家交情: ${yamen['relation'] ?? 0}', style: TextStyle(color: _muted, fontSize: 11.5)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        const SizedBox(height: 6),
                        for (final o in offices)
                          Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: _card,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: _line),
                            ),
                            child: Row(
                              children: [
                                Text(
                                  o is Map ? (o['title']?.toString() ?? '') : o.toString(),
                                  style: TextStyle(color: _textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                                ),
                                const Spacer(),
                                if (o is Map && o['holder'] != null)
                                  Text(
                                    '${o['holder']}',
                                    style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12),
                                  ),
                              ],
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _sectionTitle(String text) => Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 8, left: 2),
        child: Text(text, style: TextStyle(color: _muted, fontSize: 12.5, fontWeight: FontWeight.w600)),
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
            Text(k, style: TextStyle(color: _muted, fontSize: 12.5)),
            const Spacer(),
            Expanded(
              child: Text(
                v,
                textAlign: TextAlign.end,
                style: TextStyle(color: _textPrimary, fontSize: 13.5, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );

  Widget _kvInline(String k, String v) => Expanded(
        child: Column(
          children: [
            Text(v, style: TextStyle(color: _textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(k, style: TextStyle(color: _muted, fontSize: 11)),
          ],
        ),
      );

  static String _num(dynamic n, {int digits = 0}) {
    if (n == null) return '-';
    if (n is num) {
      return digits == 0 ? n.toInt().toString() : n.toStringAsFixed(digits);
    }
    return n.toString();
  }
}
