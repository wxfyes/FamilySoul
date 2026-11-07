import 'package:flutter/material.dart';

import '../services/api_client.dart';

/// 今日看板：一张单子看完"今天发生了什么、家里怎么样、要办什么"。
/// 数据全部来自 /api/me.digest（服务端已过滤掉"回了/待久了"这类系统噪音）。
class DigestSheet extends StatefulWidget {
  const DigestSheet({super.key, required this.api});

  final SurfCoreApiClient api;

  @override
  State<DigestSheet> createState() => _DigestSheetState();
}

class _DigestSheetState extends State<DigestSheet> {
  static const _bg = Color(0xFF12131A);
  static const _card = Color(0xFF1A1B25);
  static const _line = Colors.white10;
  static const _gold = Color(0xFFE0B252);
  static const _violet = Color(0xFF8B5CF6);

  Map<String, dynamic>? _digest;
  Map<String, dynamic>? _rawMe;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final me = await widget.api.fetchMyWorld();
    if (!mounted) return;
    setState(() {
      _rawMe = me;
      _digest = (me?['digest'] as Map?)?.cast<String, dynamic>();
      _loading = false;
    });
  }

  Widget _section(String title, Widget child) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 6),
            child: Text(title, style: const TextStyle(color: Colors.white54, fontSize: 12.5)),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)),
            child: child,
          ),
        ]),
      );

  Widget _kv(String k, String v, {Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          SizedBox(width: 64, child: Text(k, style: const TextStyle(color: Colors.white38, fontSize: 12.5))),
          Expanded(child: Text(v, style: TextStyle(color: color ?? Colors.white, fontSize: 13))),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final d = _digest ?? const <String, dynamic>{};
    final raw = _rawMe ?? const <String, dynamic>{};
    final today = (d['today'] as List?) ?? const [];
    final big = (d['big'] as List?) ?? const [];
    final kin = (d['household'] as List?) ?? const [];
    final priceMove = (d['priceMove'] as num?)?.toDouble() ?? 0;
    final unrestMove = (d['unrestMove'] as num?)?.toInt() ?? 0;

    final mil = (raw['military'] as Map?)?.cast<String, dynamic>() ?? (d['military'] as Map?)?.cast<String, dynamic>();
    final houseGuards = mil?['houseGuards'] ?? mil?['guards'];
    final retainers = mil?['retainers'] ?? mil?['escort'];
    final troops = mil?['troops'] ?? d['troops'] ?? 0;
    final items = (raw['items'] as List?) ?? (d['items'] as List?) ?? const [];
    final bandits = (raw['bandits'] as List?) ?? (d['bandits'] as List?) ?? const [];

    return Container(
      decoration: const BoxDecoration(color: _bg, borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 14),
            Row(children: [
              const Text('今日', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('第${d['day'] ?? '-'}日 ${d['hour'] ?? ''}时',
                  style: const TextStyle(color: Colors.white38, fontSize: 12)),
              const SizedBox(width: 6),
              InkWell(
                onTap: () => Navigator.pop(context),
                borderRadius: BorderRadius.circular(999),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(color: Colors.white10, shape: BoxShape.circle),
                  child: const Icon(Icons.close_rounded, size: 16, color: Colors.white70),
                ),
              ),
            ]),
            const SizedBox(height: 4),
            Text('${d['weather'] ?? ''} · ${d['place'] ?? ''}',
                style: const TextStyle(color: Colors.white38, fontSize: 11.5)),
            const SizedBox(height: 14),
            if (_loading)
              const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
            else
              Expanded(
                child: ListView(padding: EdgeInsets.zero, children: [
                  _section('家中', Column(children: [
                    _kv('现银', '${(d['silver'] as num?)?.toStringAsFixed(1) ?? '-'} 两', color: _gold),
                    _kv('府库粮', '${(d['grain'] as num?)?.toStringAsFixed(1) ?? '-'} 石'),
                    _kv('私兵', '$troops 人'),
                    if (retainers != null) _kv('随行护院', '$retainers 人'),
                    if (houseGuards != null) _kv('府里家丁', '$houseGuards 人'),
                    _kv('米价', priceMove == 0 ? '持平' : (priceMove > 0 ? '涨 $priceMove' : '跌 ${-priceMove}'),
                        color: priceMove > 0 ? const Color(0xFFFCA5A5) : const Color(0xFF86EFAC)),
                    if (unrestMove != 0) _kv('民心', unrestMove > 0 ? '浮动 +$unrestMove' : '稍安 $unrestMove'),
                    if (items.isNotEmpty)
                      _kv('随身契据', '${items.length}件（${items.take(3).map((i) => (i is Map ? i['name'] : i).toString()).join('、')}${items.length > 3 ? '…' : ''}）'),
                    if (bandits.isNotEmpty)
                      _kv('境外匪患', bandits.map((b) => '${(b is Map ? b['name'] : b) ?? '散匪'}(${(b is Map ? b['strength'] : null) ?? 0}兵)').join('、'), color: const Color(0xFFFCA5A5)),
                  ])),
                  if (kin.isNotEmpty)
                    _section('府里人', Column(
                      children: [
                        for (final p in kin)
                          _kv('${p['role'] ?? ''}', '${p['name'] ?? ''}${(p['status'] ?? '') == '' ? '' : ' · ${p['status']}'}')
                      ],
                    )),
                  _section('今日事', Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: today.isEmpty
                        ? [const Text('今日无事。', style: TextStyle(color: Colors.white38, fontSize: 12.5))]
                        : [
                            for (final e in today)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 3),
                                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text('${e['hour'] ?? 0}时 ', style: const TextStyle(color: Colors.white30, fontSize: 11.5)),
                                  Expanded(child: Text('${e['text'] ?? ''}', style: const TextStyle(color: Colors.white, fontSize: 13, height: 1.35))),
                                ]),
                              ),
                          ],
                  )),
                  if (big.isNotEmpty)
                    _section('大事记', Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final b in big)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              const Padding(padding: EdgeInsets.only(top: 5, right: 6), child: Icon(Icons.circle, size: 5, color: _violet)),
                              Expanded(child: Text('$b', style: const TextStyle(color: Colors.white70, fontSize: 12.5, height: 1.4))),
                            ]),
                          ),
                      ],
                    )),
                  if (d['decree'] != null && '${d['decree']}'.isNotEmpty)
                    _section('朝廷', Text('${d['decree']}', style: const TextStyle(color: Colors.white70, fontSize: 12.5, height: 1.4))),
                ]),
              ),
          ]),
        ),
      ),
    );
  }
}
