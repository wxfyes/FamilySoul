import 'package:flutter/material.dart';

import '../services/api_client.dart';

/// 家兵 —— 募兵、买粮、置军械、看驻军。
/// 所有动作都走服务端同一个入口（/api/world/military），扣钱扣粮，不白给。
class ArmySheet extends StatefulWidget {
  const ArmySheet({super.key, required this.api, this.onChanged});

  final SurfCoreApiClient api;
  final VoidCallback? onChanged;

  @override
  State<ArmySheet> createState() => _ArmySheetState();
}

class _ArmySheetState extends State<ArmySheet> {
  static const _bg = Color(0xFF12131A);
  static const _card = Color(0xFF1A1B25);
  static const _line = Colors.white10;
  static const _accent = Color(0xFF8B5CF6);
  static const _gold = Color(0xFFE0B252);
  static const _green = Color(0xFF4ADE80);

  Map<String, dynamic>? _world;
  Map<String, dynamic>? _wang;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final d = await widget.api.fetchMyWorld();
    if (!mounted) return;
    final factions = (d?['factions'] as List?) ?? const [];
    Map<String, dynamic>? wang;
    for (final f in factions) {
      if (f is Map && f['id'] == 'wangjia') wang = Map<String, dynamic>.from(f);
    }
    setState(() {
      _world = d;
      _wang = wang;
      _loading = false;
    });
  }

  int get _troops => (_wang?['troops'] as num?)?.toInt() ?? 0;
  int get _strength => (_wang?['strength'] as num?)?.toInt() ?? 0;
  num get _grain => (_wang?['grain'] as num?) ?? 0;
  int get _fresh => (_wang?['fresh'] as num?)?.toInt() ?? 0;
  num get _monthlyPay => (_wang?['monthlyPay'] as num?) ?? (_troops * 1.0);
  Map<String, dynamic> get _arrears => (_wang?['arrears'] as Map?)?.cast<String, dynamic>() ?? const {};
  int get _arrearsMonths => (_arrears['months'] as num?)?.toInt() ?? 0;
  num get _arrearsOwed => (_arrears['owed'] as num?) ?? 0;
  num get _silver {
    final assets = _world?['assets'];
    if (assets is Map) return (assets['silver'] as num?) ?? 0;
    return 0;
  }

  List<dynamic> get _bandits => (_world?['bandits'] as List?) ?? const [];

  Map<String, dynamic> get _stationed =>
      (_wang?['stationed'] as Map?)?.cast<String, dynamic>() ?? const {};
  Map<String, dynamic> get _gear =>
      (_wang?['gear'] as Map?)?.cast<String, dynamic>() ?? const {};

  Future<void> _act(Map<String, dynamic> body, String okPrefix) async {
    if (_busy) return;
    setState(() => _busy = true);
    final r = await widget.api.militaryAction(body);
    if (!mounted) return;
    setState(() => _busy = false);
    final ok = r?['ok'] == true;
    // 招募是"一呼百应"：报实际来投人数，而不是报你喊了多少
    String msg;
    if (!ok) {
      msg = r?['error']?.toString() ?? '没办成';
    } else if (r?['came'] != null) {
      final came = r?['came'];
      final asked = r?['asked'];
      final pay = r?['monthlyPay'];
      msg = '一呼百应：喊 $asked 人，来投 $came 人'
          '${pay != null ? '（月饷 $pay 两/月）' : ''}';
    } else {
      msg = okPrefix;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(milliseconds: 1600),
    ));
    if (ok) {
      await _load();
      widget.onChanged?.call();
    }
  }

  Future<void> _pickCount({
    required String title,
    required String unit,
    required double unitPrice,
    double? monthly,
    String? note,
    required int min,
    required int max,
    required List<int> presets,
    required String action,
    Map<String, dynamic>? extra,
  }) async {
    int count = presets.first;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSt) {
        return Container(
          decoration: const BoxDecoration(
            color: _bg,
            borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 26),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('安家银 ${unitPrice.toStringAsFixed(2)} 两 / $unit', style: const TextStyle(color: Colors.white38, fontSize: 12)),
            if (monthly != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('月饷 $monthly 两 / $unit / 月（每月初一放饷）',
                    style: const TextStyle(color: Color(0xFFE0B252), fontSize: 11.5)),
              ),
            if (note != null)
              Padding(
                padding: const EdgeInsets.only(top: 6, left: 10, right: 10),
                child: Text(note, textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white30, fontSize: 11)),
              ),
            const SizedBox(height: 18),
            Wrap(spacing: 10, runSpacing: 10, children: [
              for (final p in presets)
                _chip(
                  label: '$p',
                  selected: count == p,
                  onTap: () => setSt(() => count = p),
                ),
            ]),
            const SizedBox(height: 20),
            Text('共 ${(count * unitPrice).toStringAsFixed(2)} 两',
                style: const TextStyle(color: _gold, fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 18),
            Row(children: [
              Expanded(child: _ghost('再想想', () => Navigator.pop(ctx, false))),
              const SizedBox(width: 12),
              Expanded(child: _primary('就它了', () => Navigator.pop(ctx, true))),
            ]),
          ]),
        );
      }),
    );
    if (ok != true) return;
    await _act({...?extra, 'action': action, 'qty': count, 'count': count, 'shi': count}, '$title $count$unit');
  }

  Widget _chip({required String label, required bool selected, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? _accent.withValues(alpha: 0.22) : _card,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? _accent.withValues(alpha: 0.8) : _line),
        ),
        child: Text(label, style: TextStyle(color: selected ? Colors.white : Colors.white70, fontSize: 13)),
      ),
    );
  }

  Widget _ghost(String text, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), border: Border.all(color: _line)),
        child: Text(text, style: const TextStyle(color: Colors.white54, fontSize: 14)),
      ),
    );
  }

  Widget _primary(String text, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)]),
        ),
        child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _pill({required IconData icon, required String label, required Color color, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: color.withValues(alpha: 0.45)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)),
        child: Column(children: [
          Text(value, style: TextStyle(color: color, fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(label, style: const TextStyle(color: Colors.white38, fontSize: 11)),
        ]),
      ),
    );
  }


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

  @override
  Widget build(BuildContext context) {
    final cities = _stationed.entries.where((e) => (e.value as num) > 0).toList();
    return Container(
      decoration: const BoxDecoration(color: _bg, borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 18),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 14),
            Row(children: [
              const Text('家兵', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700)),
              const SizedBox(width: 8),
              if (_fresh > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: _gold.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
                  child: Text('新募 $_fresh 未成军', style: const TextStyle(color: _gold, fontSize: 11)),
                ),
              const Spacer(),
              Text('银 ${_silver.toStringAsFixed(1)} 两', style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ]),
            const SizedBox(height: 14),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              )
            else ...[
              Row(children: [
                _stat('兵力', '$_troops', _accent),
                const SizedBox(width: 10),
                _stat('战力', '$_strength', _green),
                const SizedBox(width: 10),
                _stat('月饷', '${_monthlyPay.toStringAsFixed(0)} 两', _gold),
              ]),
              if (_arrearsMonths > 0) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
                  ),
                  child: Row(children: [
                    const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFEF4444)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('欠饷 $_arrearsMonths 月，共 ${_arrearsOwed.toStringAsFixed(0)} 两',
                          style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 12.5)),
                    ),
                    InkWell(
                      onTap: _busy
                          ? null
                          : () async {
                              await _act({'action': 'pay_arrears'}, '积欠已清，军心大定');
                            },
                      borderRadius: BorderRadius.circular(999),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text('补发欠饷', style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 12)),
                      ),
                    ),
                  ]),
                ),
              ],
              const SizedBox(height: 16),
              Wrap(spacing: 10, runSpacing: 10, children: [
                _pill(
                  icon: Icons.groups_rounded,
                  label: '招募家丁 ·安家0.2两',
                  color: _accent,
                  onTap: () => _pickCount(
                    title: '招募家丁',
                    unit: '人',
                    unitPrice: 0.2,
                    monthly: 0.6,
                    note: '一呼百应：来投多少看你的名声与这座城的日子，喊 50 人未必来 50 个。',
                    min: 1,
                    max: 500,
                    presets: const [5, 10, 20, 50],
                    action: 'call',
                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'guard'},
                  ),
                ),
                _pill(
                  icon: Icons.shield_moon_rounded,
                  label: '招募护院 ·安家0.5两',
                  color: Colors.purpleAccent,
                  onTap: () => _pickCount(
                    title: '招募护院',
                    unit: '人',
                    unitPrice: 0.5,
                    monthly: 0.9,
                    note: '护院是精壮武师，安家银比家丁贵些，月饷 0.9 两；一样是看名声与民心来人。',
                    min: 1,
                    max: 200,
                    presets: const [2, 5, 10, 20],
                    action: 'call',
                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'retainer'},
                  ),
                ),
                _pill(
                  icon: Icons.rice_bowl_rounded,
                  label: '购粮',
                  color: _gold,
                  onTap: () => _pickCount(
                    title: '购粮',
                    unit: '石',
                    unitPrice: 1.0,
                    min: 1,
                    max: 2000,
                    presets: const [50, 100, 300],
                    action: 'grain',
                    extra: {'city': cities.isNotEmpty ? cities.first.key : ''},
                  ),
                ),
                _pill(
                  icon: Icons.hardware_rounded,
                  label: '兵器',
                  color: Colors.orangeAccent,
                  onTap: () => _pickCount(
                    title: '买兵器',
                    unit: '件',
                    unitPrice: 1.0,
                    min: 1,
                    max: 500,
                    presets: const [20, 50, 100],
                    action: 'gear',
                    extra: {'kind': 'weapon'},
                  ),
                ),
                _pill(
                  icon: Icons.shield_rounded,
                  label: '铠甲',
                  color: Colors.lightBlueAccent,
                  onTap: () => _pickCount(
                    title: '买铠甲',
                    unit: '件',
                    unitPrice: 2.0,
                    min: 1,
                    max: 500,
                    presets: const [20, 50, 100],
                    action: 'gear',
                    extra: {'kind': 'armor'},
                  ),
                ),
                _pill(
                  icon: Icons.pets_rounded,
                  label: '战马',
                  color: Colors.pinkAccent,
                  onTap: () => _pickCount(
                    title: '买战马',
                    unit: '匹',
                    unitPrice: 9.0,
                    min: 1,
                    max: 200,
                    presets: const [5, 10, 20],
                    action: 'gear',
                    extra: {'kind': 'horse'},
                  ),
                ),
                _pill(
                  icon: Icons.construction_rounded,
                  label: '攻城器械',
                  color: Colors.redAccent,
                  onTap: () => _pickCount(
                    title: '买攻城器械',
                    unit: '架',
                    unitPrice: 40.0,
                    min: 1,
                    max: 10,
                    presets: const [1, 2, 3],
                    action: 'gear',
                    extra: {'kind': 'siege'},
                  ),
                ),
              ]),
              if (_bandits.isNotEmpty) ...[
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
              const Text('驻军', style: TextStyle(color: Colors.white54, fontSize: 12.5)),
              const SizedBox(height: 8),
              if (cities.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)),
                  child: const Text('还没有兵。先募几十个家丁，再看家护院。',
                      textAlign: TextAlign.center, style: TextStyle(color: Colors.white38, fontSize: 12.5)),
                )
              else
                Column(children: [
                  for (final c in cities)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)),
                      child: Row(children: [
                        const Icon(Icons.location_city_rounded, size: 16, color: Colors.white38),
                        const SizedBox(width: 8),
                        Expanded(child: Text(c.key, style: const TextStyle(color: Colors.white, fontSize: 13.5))),
                        Text('${c.value} 人', style: const TextStyle(color: _accent, fontSize: 13, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                ]),
              Text('存粮 ${_grain.toStringAsFixed(0)} 石 · 月饷 ${_monthlyPay.toStringAsFixed(0)} 两/月 · 月粮 ${((_wang?['monthlyGrain'] as num?) ?? 0).toStringAsFixed(0)} 石/月',
                  style: const TextStyle(color: Colors.white38, fontSize: 12)),
              if (_gear.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  '军械：${_gear.entries.map((e) => '${_gearName(e.key)} ${e.value}').join(' · ')}',
                  style: const TextStyle(color: Colors.white38, fontSize: 12),
                ),
              ],
            ],
          ]),
        ),
      ),
    );
  }

  String _gearName(String k) {
    switch (k) {
      case 'weapon':
        return '兵器';
      case 'armor':
        return '铠甲';
      case 'horse':
        return '战马';
      case 'siege':
        return '攻城器械';
      default:
        return k;
    }
  }
}
