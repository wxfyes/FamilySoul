import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_client.dart';

/// 随身行囊与私人储物空间
class InventorySheet extends StatefulWidget {
  final SurfCoreApiClient api;
  final Function(String actionLine)? onAction;

  const InventorySheet({
    super.key,
    required this.api,
    this.onAction,
  });

  @override
  State<InventorySheet> createState() => _InventorySheetState();
}

class _InventorySheetState extends State<InventorySheet> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _myItems = [];
  List<Map<String, dynamic>> _presentItems = [];
  List<Map<String, dynamic>> _hereActors = [];
  List<Map<String, dynamic>> _supplyPresets = [];
  int _activeTab = 0; // 0: 随身行囊, 1: 眼前他人随身

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
    final res = await widget.api.fetchInventory();
    if (!mounted) return;
    if (res != null && res['ok'] == true) {
      setState(() {
        _myItems = ((res['items'] as List?) ?? const []).cast<Map<String, dynamic>>();
        _presentItems = ((res['presentItems'] as List?) ?? const []).cast<Map<String, dynamic>>();
        _hereActors = ((res['hereActors'] as List?) ?? const []).cast<Map<String, dynamic>>();
        _supplyPresets = ((res['supplyPresets'] as List?) ?? const []).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } else {
      setState(() {
        _loading = false;
        _error = '未能取出随身行囊，请稍后再试';
      });
    }
  }

  // 从府库/茶坊备礼入囊
  Future<void> _handlePrepare(String itemKey, String itemName) async {
    HapticFeedback.lightImpact();
    final res = await widget.api.itemAction(action: 'prepare', itemKey: itemKey);
    if (!mounted) return;
    final line = res?['line'] ?? '（已从府库备好《$itemName》收入相公随身储物空间。）';
    widget.onAction?.call(line);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(line), behavior: SnackBarBehavior.floating),
    );
    _load();
  }

  // 出示验看
  Future<void> _handleShow(Map<String, dynamic> item) async {
    HapticFeedback.lightImpact();
    final res = await widget.api.itemAction(action: 'show', itemId: item['id'].toString());
    if (!mounted) return;
    final line = res?['line'] ?? '（已展开《${item['name']}》在众人跟前勘验。）';
    widget.onAction?.call(line);
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(line), behavior: SnackBarBehavior.floating),
    );
  }

  // 赠予送礼
  Future<void> _handleGive(Map<String, dynamic> item) async {
    HapticFeedback.lightImpact();
    if (_hereActors.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('此处身旁并无他人，不知赠予何人'), behavior: SnackBarBehavior.floating),
      );
      return;
    }

    String? targetId;
    if (_hereActors.length == 1) {
      targetId = _hereActors.first['id']?.toString();
    } else {
      targetId = await showDialog<String>(
        context: context,
        builder: (ctx) => SimpleDialog(
          backgroundColor: const Color(0xFF1E222D),
          title: Text(
            '将《${item['name']}》赠予何人？',
            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          children: _hereActors.map((a) {
            final name = a['name'] ?? a['id'];
            final role = a['role'] ?? '';
            return SimpleDialogOption(
              onPressed: () => Navigator.pop(ctx, a['id'].toString()),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    const Icon(Icons.person_outline_rounded, color: Color(0xFF8B5CF6), size: 18),
                    const SizedBox(width: 8),
                    Text(name, style: const TextStyle(color: Colors.white, fontSize: 15)),
                    if (role.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Text('（$role）', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                    ],
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      );
    }

    if (targetId == null || !mounted) return;

    final res = await widget.api.itemAction(
      action: 'give',
      itemId: item['id'].toString(),
      targetActorId: targetId,
    );
    if (!mounted) return;

    final line = res?['line'] ?? '（已把《${item['name']}》赠予对方。）';
    widget.onAction?.call(line);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(line), behavior: SnackBarBehavior.floating),
    );
    _load();
  }

  // 索要/讨取
  Future<void> _handleAsk(Map<String, dynamic> item) async {
    HapticFeedback.lightImpact();
    final targetId = item['holder']?.toString();
    if (targetId == null || targetId.isEmpty) return;

    final res = await widget.api.itemAction(
      action: 'ask',
      itemId: item['id'].toString(),
      targetActorId: targetId,
    );
    if (!mounted) return;

    final line = res?['line'] ?? '（已收归随身行囊。）';
    widget.onAction?.call(line);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(line), behavior: SnackBarBehavior.floating),
    );
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF14161E) : Colors.white;
    final fg = isDark ? Colors.white : const Color(0xFF0F172A);

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 顶端拉条
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(top: 10, bottom: 12),
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // 头部标题与在场人数
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.inventory_2_rounded, color: Color(0xFFF59E0B), size: 18),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '随身行囊 · 储物空间',
                    style: TextStyle(
                      color: fg,
                      fontSize: 16.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // 分栏切换（行囊物产 / 眼前他人随身物）
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
              child: Container(
                height: 36,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E222D) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () => setState(() => _activeTab = 0),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _activeTab == 0
                                ? (isDark ? const Color(0xFF2C3242) : Colors.white)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: _activeTab == 0
                                ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4)]
                                : null,
                          ),
                          child: Text(
                            '🎒 随身物产（${_myItems.length}）',
                            style: TextStyle(
                              color: _activeTab == 0 ? fg : Colors.grey,
                              fontSize: 12.5,
                              fontWeight: _activeTab == 0 ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: InkWell(
                        onTap: () => setState(() => _activeTab = 1),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _activeTab == 1
                                ? (isDark ? const Color(0xFF2C3242) : Colors.white)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: _activeTab == 1
                                ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4)]
                                : null,
                          ),
                          child: Text(
                            '👀 眼前他人随身（${_presentItems.length}）',
                            style: TextStyle(
                              color: _activeTab == 1 ? fg : Colors.grey,
                              fontSize: 12.5,
                              fontWeight: _activeTab == 1 ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const Divider(height: 1, thickness: 0.8),

            // 内容列表
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                  : _error != null
                      ? Center(child: Text(_error!, style: const TextStyle(color: Colors.redAccent)))
                      : _activeTab == 0
                          ? _buildMyItemsList(isDark)
                          : _buildPresentItemsList(isDark),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSupplyBar(bool isDark) {
    final presets = _supplyPresets.isNotEmpty
        ? _supplyPresets
        : const [
            {'key': '茶叶', 'name': '紫阳山头春茶（明前极品锡罐）'},
            {'key': '步摇', 'name': '赤金点翠步摇'},
            {'key': '玉镯', 'name': '羊脂白玉腕镯'},
            {'key': '绸缎', 'name': '江南苏绣云锦一匹'},
            {'key': '佳酿', 'name': '陈年女儿红一坛'},
            {'key': '银票', 'name': '五十两会票礼封'},
          ];
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E222D) : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFFF59E0B).withValues(alpha: 0.25),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.add_box_outlined, size: 15, color: Color(0xFFF59E0B)),
              const SizedBox(width: 6),
              Text(
                '从府库 / 茶坊备礼入囊（点击即刻收入储物空间）',
                style: TextStyle(
                  color: isDark ? Colors.white70 : const Color(0xFF334155),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: presets.map((p) {
              final key = p['key']?.toString() ?? 'tea_mingqian';
              final name = p['name']?.toString() ?? '极品春茶';
              const labelMap = {
                'tea_mingqian': '春茶',
                'wine_huadiao': '花雕',
                'pastry_box': '茶点',
                'hairpin_gold': '步摇',
                'jade_bangle': '玉镯',
                'silk_brocade': '云锦',
                'rouge_box': '香粉',
                'silver_note': '银票',
                'banquet_card': '请帖',
                '茶叶': '春茶',
                '步摇': '步摇',
                '玉镯': '玉镯',
                '绸缎': '云锦',
                '佳酿': '花雕',
                '银票': '银票',
              };
              final label = p['label']?.toString() ?? labelMap[key] ?? (p['kind']?.toString() ?? '珍礼');
              return InkWell(
                onTap: () => _handlePrepare(key, name),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '+ 备$label',
                    style: const TextStyle(
                      color: Color(0xFFF59E0B),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildMyItemsList(bool isDark) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
      itemCount: _myItems.length + 1,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (ctx, i) {
        if (i == 0) {
          return _buildSupplyBar(isDark);
        }
        final it = _myItems[i - 1];
        final name = it['name']?.toString() ?? '未知宝物';
        final kind = it['kind']?.toString() ?? '杂物';
        final note = it['note']?.toString() ?? '';
        final isOfficial = kind == '官印' || kind == '敕牒';
        final isNonGiftable = isOfficial || kind == '契纸';

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1B1E28) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isOfficial
                  ? const Color(0xFFF59E0B).withValues(alpha: 0.45)
                  : (isDark ? Colors.white.withValues(alpha: 0.08) : const Color(0xFFE2E8F0)),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: (isOfficial ? const Color(0xFFEF4444) : const Color(0xFFF59E0B)).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  kind == '官印'
                      ? Icons.military_tech_rounded
                      : (kind == '敕牒' ? Icons.verified_rounded : Icons.description_outlined),
                  color: isOfficial ? const Color(0xFFF59E0B) : const Color(0xFFF59E0B),
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            name,
                            style: TextStyle(
                              color: isOfficial
                                  ? const Color(0xFFFBBF24)
                                  : (isDark ? Colors.white : const Color(0xFF0F172A)),
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: (isOfficial ? const Color(0xFFEF4444) : const Color(0xFF8B5CF6)).withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            kind,
                            style: TextStyle(
                              color: isOfficial ? const Color(0xFFFCA5A5) : const Color(0xFFA78BFA),
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (note.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        note,
                        style: TextStyle(color: isDark ? Colors.white54 : const Color(0xFF64748B), fontSize: 12),
                        maxLines: isOfficial ? 2 : 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 6),
              // 出示验看
              InkWell(
                onTap: () => _handleShow(it),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: (isOfficial ? const Color(0xFFF59E0B) : const Color(0xFF38BDF8)).withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isOfficial ? Icons.verified_user_outlined : Icons.remove_red_eye_outlined,
                        size: 14,
                        color: isOfficial ? const Color(0xFFFBBF24) : const Color(0xFF38BDF8),
                      ),
                      const SizedBox(width: 3),
                      Text(
                        isOfficial ? '亮印出示' : '出示',
                        style: TextStyle(
                          color: isOfficial ? const Color(0xFFFBBF24) : const Color(0xFF38BDF8),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (!isNonGiftable) ...[
                const SizedBox(width: 6),
                // 赠予送人
                InkWell(
                  onTap: () => _handleGive(it),
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEC4899).withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.card_giftcard_rounded, size: 14, color: Color(0xFFEC4899)),
                        SizedBox(width: 3),
                        Text('赠予', style: TextStyle(color: Color(0xFFEC4899), fontSize: 12, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildPresentItemsList(bool isDark) {
    if (_presentItems.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 40),
          child: Text(
            '眼前在场之人未携有可供查验索取的珍物',
            style: TextStyle(color: isDark ? Colors.white38 : Colors.grey),
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
      itemCount: _presentItems.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (ctx, i) {
        final it = _presentItems[i];
        final name = it['name']?.toString() ?? '未知物件';
        final kind = it['kind']?.toString() ?? '杂物';
        final holderName = it['holderName']?.toString() ?? '在场之人';
        final holderRole = it['holderRole']?.toString() ?? '';

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1B1E28) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.08) : const Color(0xFFE2E8F0),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFF8B5CF6).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.shield_outlined, color: Color(0xFF8B5CF6), size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          name,
                          style: TextStyle(
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            kind,
                            style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 10.5, fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '持有者：$holderName${holderRole.isNotEmpty ? "（$holderRole）" : ""}',
                      style: TextStyle(color: isDark ? Colors.white54 : const Color(0xFF64748B), fontSize: 12),
                    ),
                  ],
                ),
              ),
              // 索要/讨取
              InkWell(
                onTap: () => _handleAsk(it),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.pan_tool_outlined, size: 14, color: Color(0xFF10B981)),
                      SizedBox(width: 3),
                      Text('索取', style: TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

