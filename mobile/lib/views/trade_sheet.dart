import 'package:flutter/material.dart';

import '../services/api_client.dart';

/// 商货行栈 —— 盐 / 茶 / 丝 / 铁 / 药材，现货买卖。
/// 价格随全国指数与所在城景气浮动，买进卖出都从这里走。
class TradeSheet extends StatefulWidget {
  const TradeSheet({super.key, required this.api, this.onChanged});

  final SurfCoreApiClient api;
  final VoidCallback? onChanged;

  @override
  State<TradeSheet> createState() => _TradeSheetState();
}

class _TradeSheetState extends State<TradeSheet> {
  static const _bg = Color(0xFF12131A);
  static const _card = Color(0xFF1A1B25);
  static const _line = Colors.white10;
  static const _accent = Color(0xFF8B5CF6);
  static const _gold = Color(0xFFE0B252);

  Map<String, dynamic>? _goods;
  double _silver = 0;
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
    setState(() {
      _goods = (d?['goods'] as Map?)?.cast<String, dynamic>();
      final assets = d?['assets'];
      if (assets is Map) _silver = (assets['silver'] as num?)?.toDouble() ?? 0;
      _loading = false;
    });
  }

  Map<String, dynamic> get _stock => (_goods?['stock'] as Map?)?.cast<String, dynamic>() ?? const {};
  Map<String, dynamic> get _prices => (_goods?['prices'] as Map?)?.cast<String, dynamic>() ?? const {};

  Future<void> _trade(String good, String action, int qty) async {
    if (_busy) return;
    setState(() => _busy = true);
    final r = await widget.api.tradeAction({
      'action': action,
      'good': good,
      'qty': qty,
      'city': (_goods?['city'] ?? '').toString(),
    });
    if (!mounted) return;
    setState(() => _busy = false);
    final ok = r?['ok'] == true;
    final msg = ok
        ? (action == 'buy' ? '买入 $qty，花 ${r?['cost']} 两' : '卖出 $qty，得 ${r?['gain']} 两')
        : (r?['error']?.toString() ?? '没办成');
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(milliseconds: 1500),
    ));
    if (ok) {
      await _load();
      widget.onChanged?.call();
    }
  }

  Widget _capsule(String label, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: _busy ? null : onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: color.withValues(alpha: 0.45)),
        ),
        child: Text(label, style: TextStyle(color: color, fontSize: 12.5, fontWeight: FontWeight.w600)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final keys = ['salt', 'tea', 'silk', 'iron', 'herb'];
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
              const Text('商货行栈', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('银 ${_silver.toStringAsFixed(1)} 两', style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ]),
            const SizedBox(height: 6),
            const Text('买进卖出，价钱随行情与所在城起落', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
            const SizedBox(height: 14),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 36),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              )
            else
              Column(children: [
                for (final k in keys)
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${_prices[k]?['name'] ?? k}', style: const TextStyle(color: Colors.white, fontSize: 13.5)),
                          const SizedBox(height: 2),
                          Text('市价 ${_prices[k]?['price'] ?? '-'} 两 · 存 ${_stock[k] ?? 0}',
                              style: const TextStyle(color: Colors.white38, fontSize: 11.5)),
                        ]),
                      ),
                      _capsule('买 10', _gold, () => _trade(k, 'buy', 10)),
                      const SizedBox(width: 8),
                      _capsule('卖 10', _accent, () => _trade(k, 'sell', 10)),
                    ]),
                  ),
              ]),
          ]),
        ),
      ),
    );
  }
}
