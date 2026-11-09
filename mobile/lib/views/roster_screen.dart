import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api_client.dart';

/// 城中世情名录 · 人物好感羁绊看板
class RosterScreen extends StatefulWidget {
  const RosterScreen({
    super.key,
    required this.api,
    this.onActionMessage,
  });

  final SurfCoreApiClient api;
  final void Function(String message)? onActionMessage;

  @override
  State<RosterScreen> createState() => _RosterScreenState();
}

class _RosterScreenState extends State<RosterScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _allActors = [];
  List<Map<String, dynamic>> _cities = [];

  String _searchQuery = '';
  String _selectedCity = '全部';
  String _selectedCategory = 'all'; // all, here, house, love, court, merchant
  final TextEditingController _searchCtrl = TextEditingController();

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;
  Color get _bg => _isDark ? const Color(0xFF0F1115) : const Color(0xFFF1F5F9);
  Color get _card => _isDark ? const Color(0xFF171A21) : Colors.white;
  Color get _line => _isDark ? const Color(0xFF242833) : const Color(0xFFE2E8F0);
  Color get _muted => _isDark ? const Color(0xFF8A93A6) : const Color(0xFF64748B);
  Color get _textPrimary => _isDark ? Colors.white : const Color(0xFF0F172A);
  Color get _textSecondary => _isDark ? const Color(0xFFCBD5E1) : const Color(0xFF334155);

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

    final data = await widget.api.fetchRelationships();
    if (!mounted) return;

    if (data == null || data['ok'] != true) {
      setState(() {
        _loading = false;
        _error = '未能获取世情名录，请检查网络';
      });
      return;
    }

    final rawActors = (data['actors'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final rawCities = (data['cities'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    setState(() {
      _allActors = rawActors;
      _cities = rawCities;
      _loading = false;
    });
  }

  List<Map<String, dynamic>> _getFilteredActors() {
    return _allActors.where((a) {
      // 1. 地区过滤
      if (_selectedCity != '全部') {
        final c = a['city']?.toString() ?? '临江府';
        if (c != _selectedCity) return false;
      }

      // 2. 身份圈子过滤
      if (_selectedCategory == 'here') {
        if (a['here'] != true) return false;
      } else if (_selectedCategory == 'house') {
        if (a['household'] != true) return false;
      } else if (_selectedCategory == 'love') {
        if (a['category'] != 'love') return false;
      } else if (_selectedCategory == 'court') {
        if (a['category'] != 'court') return false;
      } else if (_selectedCategory == 'merchant') {
        final role = a['role']?.toString() ?? '';
        if (!role.contains('商') && !role.contains('掌柜') && !role.contains('老板') && !role.contains('市井')) {
          return false;
        }
      }

      // 3. 搜索过滤
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final name = (a['name']?.toString() ?? '').toLowerCase();
        final role = (a['role']?.toString() ?? '').toLowerCase();
        final place = (a['place']?.toString() ?? '').toLowerCase();
        final marital = (a['marital']?.toString() ?? '').toLowerCase();
        if (!name.contains(q) && !role.contains(q) && !place.contains(q) && !marital.contains(q)) {
          return false;
        }
      }

      return true;
    }).toList();
  }

  Future<void> _handleGo(Map<String, dynamic> actor) async {
    final placeName = actor['place']?.toString() ?? '';
    final name = actor['name']?.toString() ?? '';
    if (placeName.isEmpty) return;

    HapticFeedback.mediumImpact();
    final err = await widget.api.goTo(placeName);
    if (!mounted) return;

    if (err == null) {
      widget.onActionMessage?.call('（你寻访来到了「$placeName」，见到了$name。）');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('已走到「$placeName」'),
          duration: const Duration(seconds: 2),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
      _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('动身失败：$err'),
          duration: const Duration(seconds: 2),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _handleSummon(Map<String, dynamic> actor) async {
    final name = actor['name']?.toString() ?? '';
    final id = actor['id']?.toString() ?? name;
    if (name.isEmpty) return;

    HapticFeedback.mediumImpact();
    final ok = await widget.api.summon(id);
    if (!mounted) return;

    if (ok) {
      widget.onActionMessage?.call('（你差人将「$name」唤到了跟前。）');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('已传唤「$name」来到跟前'),
          duration: const Duration(seconds: 2),
          backgroundColor: const Color(0xFF8B5CF6),
        ),
      );
      _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('传唤失败：脱不开身'),
          duration: Duration(seconds: 2),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _getFilteredActors();

    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        titleSpacing: 14,
        iconTheme: IconThemeData(color: _textPrimary),
        title: Text(
          '世情名录 · 人物好感',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: _textPrimary),
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
              : Column(
                  children: [
                    // 1. 搜索框
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
                      child: Container(
                        decoration: BoxDecoration(
                          color: _card,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: _line),
                        ),
                        child: TextField(
                          controller: _searchCtrl,
                          style: TextStyle(color: _textPrimary, fontSize: 13.5),
                          onChanged: (v) => setState(() => _searchQuery = v.trim()),
                          decoration: InputDecoration(
                            hintText: '🔍 快速搜索人物名、身份、地点...',
                            hintStyle: TextStyle(color: _muted, fontSize: 13),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                            isDense: true,
                            suffixIcon: _searchQuery.isNotEmpty
                                ? IconButton(
                                    icon: Icon(Icons.clear_rounded, size: 16, color: _muted),
                                    onPressed: () {
                                      _searchCtrl.clear();
                                      setState(() => _searchQuery = '');
                                    },
                                  )
                                : null,
                          ),
                        ),
                      ),
                    ),

                    // 2. 地区横向药丸选择器（按府县分类）
                    if (_cities.isNotEmpty)
                      Container(
                        height: 38,
                        margin: const EdgeInsets.only(bottom: 6),
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          itemCount: _cities.length,
                          itemBuilder: (context, idx) {
                            final c = _cities[idx];
                            final name = c['name']?.toString() ?? '';
                            final count = c['count'] ?? 0;
                            final active = _selectedCity == name;
                            return Container(
                              margin: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(
                                  '$name ($count)',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: active ? Colors.white : _muted,
                                    fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                                  ),
                                ),
                                selected: active,
                                onSelected: (sel) {
                                  if (sel) setState(() => _selectedCity = name);
                                },
                                selectedColor: const Color(0xFF6D28D9),
                                backgroundColor: _card,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  side: BorderSide(
                                    color: active ? const Color(0xFF8B5CF6) : _line,
                                  ),
                                ),
                                showCheckmark: false,
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              ),
                            );
                          },
                        ),
                      ),

                    // 3. 圈子分类药丸选择器
                    Container(
                      height: 34,
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        children: [
                          _catChip('all', '全部'),
                          _catChip('here', '在场之人'),
                          _catChip('house', '府中内眷'),
                          _catChip('love', '红颜相好'),
                          _catChip('merchant', '市井商贾'),
                          _catChip('court', '官府朝臣'),
                        ],
                      ),
                    ),

                    // 4. 人物名录列表
                    Expanded(
                      child: filtered.isEmpty
                          ? Center(
                              child: Text('没有符合条件的人物', style: TextStyle(color: _muted, fontSize: 13)),
                            )
                          : ListView.builder(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(14, 0, 14, 28),
                              itemCount: filtered.length,
                              itemBuilder: (context, idx) => _actorCard(filtered[idx]),
                            ),
                    ),
                  ],
                ),
    );
  }

  Widget _catChip(String key, String label) {
    final active = _selectedCategory == key;
    return Container(
      margin: const EdgeInsets.only(right: 6),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => setState(() => _selectedCategory = key),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: active
                ? (_isDark ? const Color(0xFF2E1065) : const Color(0xFFEDE9FE))
                : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: active ? const Color(0xFFA78BFA) : _line,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              color: active
                  ? (_isDark ? const Color(0xFFDDD6FE) : const Color(0xFF6D28D9))
                  : _muted,
              fontWeight: active ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }

  Widget _actorCard(Map<String, dynamic> a) {
    final name = a['name']?.toString() ?? '无名';
    final city = a['city']?.toString() ?? '临江府';
    final role = a['role']?.toString() ?? '百姓';
    final marital = a['marital']?.toString() ?? '';
    final place = a['place']?.toString() ?? '—';
    final money = a['money'] ?? 0;
    final trust = (a['trust'] as num?)?.toInt() ?? 0;
    final desire = (a['desire'] as num?)?.toInt() ?? 0;
    final grievance = (a['grievance'] as num?)?.toInt() ?? 0;
    final attitude = a['attitude']?.toString() ?? '—';
    final intimacy = a['intimacy']?.toString() ?? '—';
    final here = a['here'] == true;
    final canSummon = a['canSummon'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: here ? const Color(0xFF8B5CF6).withValues(alpha: 0.6) : _line),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 顶行：姓名、城市、身份标签、亲密状态、动作按钮
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // 头像首字圆徽
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: here
                      ? const Color(0xFF8B5CF6)
                      : (_isDark ? const Color(0xFF242833) : const Color(0xFFE2E8F0)),
                ),
                alignment: Alignment.center,
                child: Text(
                  name.isNotEmpty ? name.characters.first : '人',
                  style: TextStyle(
                    color: here ? Colors.white : _textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(name, style: TextStyle(color: _textPrimary, fontSize: 15, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: _isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text('📍 $city', style: TextStyle(fontSize: 10.5, color: _muted)),
                        ),
                        if (here) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0xFF065F46),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('在此处', style: TextStyle(fontSize: 10.5, color: Color(0xFF6EE7B7))),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [role, if (marital.isNotEmpty) marital].join(' · '),
                      style: TextStyle(color: _muted, fontSize: 11.5),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              // 亲密标签（有孕、月事、和睦等）
              if (intimacy != '—')
                Container(
                  margin: const EdgeInsets.only(right: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: intimacy.contains('有孕')
                        ? (_isDark ? const Color(0xFF831843) : const Color(0xFFFCE7F3))
                        : (intimacy.contains('月事')
                            ? (_isDark ? const Color(0xFF450A0A) : const Color(0xFFFEE2E2))
                            : (_isDark ? const Color(0xFF312E81) : const Color(0xFFE0E7FF))),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    intimacy,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: intimacy.contains('有孕')
                          ? const Color(0xFFEC4899)
                          : (intimacy.contains('月事') ? const Color(0xFFEF4444) : const Color(0xFF6366F1)),
                    ),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 8),

          // 所在位置与私房钱
          Row(
            children: [
              Icon(Icons.location_on_outlined, size: 13, color: _muted),
              const SizedBox(width: 3),
              Expanded(
                child: Text(
                  place,
                  style: TextStyle(color: _textSecondary, fontSize: 11.5),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Icon(Icons.monetization_on_outlined, size: 13, color: Color(0xFFF59E0B)),
              const SizedBox(width: 3),
              Text(
                '私房 $money 两',
                style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 11.5, fontWeight: FontWeight.w500),
              ),
            ],
          ),

          const SizedBox(height: 8),
          Divider(height: 1, color: _line),
          const SizedBox(height: 8),

          // 三项心性指标进度条（信任、欲望、怨怼）
          Row(
            children: [
              Expanded(child: _barItem('信任', trust, const Color(0xFF10B981))),
              const SizedBox(width: 8),
              Expanded(child: _barItem('欲望', desire, const Color(0xFFEC4899))),
              const SizedBox(width: 8),
              Expanded(child: _barItem('怨怼', grievance, const Color(0xFF64748B))),
            ],
          ),

          const SizedBox(height: 8),

          // 态度评语气泡与操作按钮
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _isDark ? const Color(0xFF0F1115) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: _line.withValues(alpha: 0.5)),
                  ),
                  child: Text(
                    '💬 $attitude',
                    style: TextStyle(fontSize: 11, color: _textSecondary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // 按钮：过去 / 叫她来
              if (!here) ...[
                OutlinedButton(
                  onPressed: () => _handleGo(a),
                  style: OutlinedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                    side: const BorderSide(color: Color(0xFF8B5CF6)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  child: const Text('去她这', style: TextStyle(fontSize: 11.5, color: Color(0xFF8B5CF6))),
                ),
                if (canSummon) ...[
                  const SizedBox(width: 6),
                  ElevatedButton(
                    onPressed: () => _handleSummon(a),
                    style: ElevatedButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                      backgroundColor: const Color(0xFF8B5CF6),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    ),
                    child: const Text('叫她来', style: TextStyle(fontSize: 11.5)),
                  ),
                ],
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _barItem(String label, int val, Color barColor) {
    final v = val.clamp(0, 100);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: TextStyle(fontSize: 10.5, color: _muted)),
            const Spacer(),
            Text('$v', style: TextStyle(fontSize: 10.5, color: _muted, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 3),
        ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: LinearProgressIndicator(
            value: v / 100.0,
            minHeight: 4,
            backgroundColor: _isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.06),
            valueColor: AlwaysStoppedAnimation<Color>(barColor),
          ),
        ),
      ],
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
}
