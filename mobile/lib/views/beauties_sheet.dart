import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_client.dart';

/// 天下名媛佳丽 · 妙龄图鉴（35岁以下）
class BeautiesSheet extends StatefulWidget {
  final SurfCoreApiClient api;
  final Function(String actionMsg)? onAction;

  const BeautiesSheet({
    super.key,
    required this.api,
    this.onAction,
  });

  @override
  State<BeautiesSheet> createState() => _BeautiesSheetState();
}

class _BeautiesSheetState extends State<BeautiesSheet> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _allBeauties = [];
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final res = await widget.api.fetchBeauties();
    if (!mounted) return;
    if (res != null && res['ok'] == true) {
      setState(() {
        _allBeauties = ((res['beauties'] as List?) ?? const []).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } else {
      setState(() {
        _loading = false;
        _error = '未能搜罗天下佳丽，请检查网络';
      });
    }
  }

  List<Map<String, dynamic>> _filteredBeauties() {
    if (_searchQuery.isEmpty) return _allBeauties;
    final q = _searchQuery.toLowerCase();
    return _allBeauties.where((b) {
      final name = (b['name'] ?? '').toString().toLowerCase();
      final role = (b['role'] ?? '').toString().toLowerCase();
      final city = (b['city'] ?? '').toString().toLowerCase();
      final place = (b['place'] ?? '').toString().toLowerCase();
      final appearance = (b['appearance'] ?? '').toString().toLowerCase();
      return name.contains(q) || role.contains(q) || city.contains(q) || place.contains(q) || appearance.contains(q);
    }).toList();
  }

  // 动身去找她
  Future<void> _handleGo(Map<String, dynamic> b) async {
    HapticFeedback.lightImpact();
    final place = b['place']?.toString() ?? '';
    if (place.isEmpty) return;
    final line = await widget.api.goTo(place);
    if (!mounted) return;
    Navigator.pop(context);
    widget.onAction?.call(line ?? '（已动身前往 $place 寻访 ${b['name']}。）');
  }

  // 唤来相见
  Future<void> _handleSummon(Map<String, dynamic> b) async {
    HapticFeedback.lightImpact();
    final id = b['id']?.toString() ?? '';
    if (id.isEmpty) return;
    final ok = await widget.api.summon(id);
    if (!mounted) return;
    Navigator.pop(context);
    widget.onAction?.call(ok ? '（已差人知会 ${b['name']} 前来相叙。）' : '（差人去传唤，但未能叫来。）');
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF14161E) : Colors.white;
    final fg = isDark ? Colors.white : const Color(0xFF0F172A);
    final filtered = _filteredBeauties();

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
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

            // 头部标题与统计
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEC4899).withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.favorite_rounded, color: Color(0xFFEC4899), size: 18),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '天下名媛佳丽 · 妙龄图鉴',
                        style: TextStyle(
                          color: fg,
                          fontSize: 16.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '已录入 ${_allBeauties.length} 位妙龄女子（35岁以下）· 随时攻略探访',
                        style: TextStyle(color: isDark ? Colors.white54 : const Color(0xFF64748B), fontSize: 11),
                      ),
                    ],
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // 搜索框
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
              child: Container(
                height: 38,
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E222D) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: isDark ? Colors.white12 : const Color(0xFFE2E8F0)),
                ),
                child: TextField(
                  controller: _searchCtrl,
                  style: TextStyle(color: fg, fontSize: 13),
                  onChanged: (v) => setState(() => _searchQuery = v.trim()),
                  decoration: InputDecoration(
                    hintText: '搜佳丽芳名、身份、城池、身段容貌…',
                    hintStyle: const TextStyle(color: Colors.grey, fontSize: 12.5),
                    prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Colors.grey),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 16, color: Colors.grey),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 9),
                  ),
                ),
              ),
            ),

            const Divider(height: 1, thickness: 0.8),

            // 佳丽卡片列表
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                  : _error != null
                      ? Center(child: Text(_error!, style: const TextStyle(color: Colors.redAccent)))
                      : filtered.isEmpty
                          ? Center(
                              child: Text('未搜罗到符合条件的佳丽', style: TextStyle(color: isDark ? Colors.white38 : Colors.grey)),
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(14, 10, 14, 24),
                              itemCount: filtered.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (ctx, i) => _buildBeautyCard(filtered[i], isDark),
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBeautyCard(Map<String, dynamic> b, bool isDark) {
    final name = b['name']?.toString() ?? '佳人';
    final age = b['age'] ?? 18;
    final role = b['role']?.toString() ?? '闺秀';
    final marital = b['marital']?.toString() ?? '';
    final city = b['city']?.toString() ?? '临江府';
    final place = b['place']?.toString() ?? '';
    final trust = (b['trust'] as num?)?.toInt() ?? 0;
    final desire = (b['desire'] as num?)?.toInt() ?? 0;
    final attitude = b['attitude']?.toString() ?? '清冷自持';
    final intimacy = b['intimacy']?.toString() ?? '守礼';
    final appearance = b['appearance']?.toString() ?? '清丽端方';
    final secret = b['secret']?.toString() ?? '';
    final isHere = b['here'] == true;
    final isConsummated = b['consummated'] == true;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1B1E28) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isHere
              ? const Color(0xFFEC4899)
              : (isDark ? Colors.white.withValues(alpha: 0.08) : const Color(0xFFE2E8F0)),
          width: isHere ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 姓名、芳龄、身份、名分标签
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: isConsummated
                    ? const Color(0xFFEC4899)
                    : const Color(0xFF8B5CF6).withValues(alpha: 0.8),
                child: Text(
                  name.isNotEmpty ? name.characters.first : '美',
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '$name · $age岁',
                          style: TextStyle(
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (isHere) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('在此处', style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                        ],
                        if (isConsummated) ...[
                          const SizedBox(width: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEC4899).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('相好', style: TextStyle(color: Color(0xFFEC4899), fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$role · $marital · $city · 关系:$intimacy',
                      style: TextStyle(color: isDark ? Colors.white54 : const Color(0xFF64748B), fontSize: 11.5),
                    ),
                  ],
                ),
              ),
              // 所在地点
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2C3242) : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.place_outlined, size: 12, color: Colors.grey),
                    const SizedBox(width: 2),
                    Text(place, style: TextStyle(color: isDark ? Colors.white70 : const Color(0xFF334155), fontSize: 11)),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          // 容貌与身段描摹
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF14161E) : Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: isDark ? Colors.white10 : const Color(0xFFE2E8F0)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.auto_awesome_rounded, size: 14, color: Color(0xFFEC4899)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    appearance,
                    style: TextStyle(
                      color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF334155),
                      fontSize: 12,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 6),

          // 攻略秘要
          if (secret.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.lightbulb_outline_rounded, size: 14, color: Color(0xFFF59E0B)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      secret,
                      style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 11.5, height: 1.35),
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 8),

          // 好感与心性条 + 操作按钮
          Row(
            children: [
              // 信任与欲望指示
              Expanded(
                child: Row(
                  children: [
                    _buildStatBar('信任', trust, const Color(0xFF10B981)),
                    const SizedBox(width: 10),
                    _buildStatBar('情欲', desire, const Color(0xFFEC4899)),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        attitude,
                        style: TextStyle(color: isDark ? Colors.white60 : const Color(0xFF475569), fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),

              // 按钮组
              if (!isHere)
                InkWell(
                  onTap: () => _handleGo(b),
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFF8B5CF6).withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.directions_walk_rounded, size: 13, color: Color(0xFF8B5CF6)),
                        SizedBox(width: 2),
                        Text('去找她', style: TextStyle(color: Color(0xFF8B5CF6), fontSize: 11.5, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
              const SizedBox(width: 6),
              InkWell(
                onTap: () => _handleSummon(b),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEC4899).withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.chat_bubble_outline_rounded, size: 13, color: Color(0xFFEC4899)),
                      const SizedBox(width: 2),
                      Text(isHere ? '说话' : '叫来', style: const TextStyle(color: Color(0xFFEC4899), fontSize: 11.5, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatBar(String label, int val, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 10.5)),
        const SizedBox(width: 3),
        SizedBox(
          width: 36,
          height: 5,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(2.5),
            child: LinearProgressIndicator(
              value: (val.clamp(0, 100)) / 100.0,
              backgroundColor: Colors.grey.withValues(alpha: 0.2),
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ),
        const SizedBox(width: 3),
        Text('$val', style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
