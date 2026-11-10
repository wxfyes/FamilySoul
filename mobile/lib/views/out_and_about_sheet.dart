import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api_client.dart';
import 'roster_screen.dart';

/// 出门 · 找人 · 赴约 —— 现代国风微质感交互抽屉
/// 彻底告别密密麻麻长列表：常驻快捷磁贴 + 圈子标签秒切 + 真实街市烟火标注
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
  String _query = '';

  // 场景分类与人物圈子过滤
  String _placeFilter = 'all'; // all, hot, estate, market, court
  String _peopleFilter = 'all'; // all, family, manager, confidant, official

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
      String text = (_serverLine != null && _serverLine!.isNotEmpty) ? _serverLine! : okText;
      _serverLine = null;
      // 治理服务端未落地房间透传出来的裸露英文 ID，净化为中文雅称
      text = text.replaceAll(RegExp(r'house_[a-zA-Z0-9_]+__gate'), '大门外')
                 .replaceAll(RegExp(r'house_[a-zA-Z0-9_]+'), '宅院')
                 .replaceAll(RegExp(r'place_\d+'), '市井');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(text),
          duration: const Duration(milliseconds: 2200),
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xFF1E2230),
        ),
      );
      widget.onChanged?.call();
      await _load();
    }
  }

  String? _serverLine;

  Future<bool> _todo(String id, String action) async {
    return await widget.api.todoAction(id, action);
  }

  Future<bool> _goTo(String place) async {
    final line = await widget.api.goTo(place);
    if (line == null) return false;
    _serverLine = line;
    return true;
  }

  /// 找人专属寻访：真人调用 summon 直达精准房间，普通 NPC 传人名给 goTo 精准定位到人
  Future<bool> _findPerson(Map p) async {
    final id = (p['id'] ?? '').toString();
    final name = (p['name'] ?? '').toString();
    final canSummon = p['canSummon'] != false;
    if (!canSummon) {
      return await widget.api.summon(id);
    }
    final line = await widget.api.goTo(name.isNotEmpty ? name : (p['place'] ?? '').toString());
    if (line == null) return false;
    _serverLine = line;
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final d = _menu;
    String where = (d?['where'] is Map) ? (d!['where'] as Map)['name']?.toString() ?? '' : '';
    if (where.isEmpty || where.contains('house_') || where.contains('__gate') || RegExp(r'^[a-zA-Z0-9_-]+$').hasMatch(where)) {
      where = where.contains('__gate') ? '宅院门外' : (where.isEmpty ? '门外' : where);
    }
    final clock = (d?['clock'] is Map) ? d!['clock'] as Map : const {};
    final kb = MediaQuery.of(context).viewInsets.bottom;
    final screenH = MediaQuery.of(context).size.height;
    final sheetH = ((screenH - kb) * 0.86).clamp(320.0, screenH);

    return Padding(
      padding: EdgeInsets.only(bottom: kb),
      child: SafeArea(
        child: Container(
          height: sheetH,
          decoration: const BoxDecoration(
            color: Color(0xFF10121A),
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // 顶部拖动条与状态栏
              Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(top: 8, bottom: 6),
                decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.explore_rounded, size: 16, color: Color(0xFFA78BFA)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        where.isEmpty ? '临江市井 · 闲逛漫步' : '此刻身在「$where」 · 第${clock['day'] ?? '-'}日 ${clock['hour'] ?? '-'}时',
                        style: const TextStyle(fontSize: 13, color: Colors.white70, fontWeight: FontWeight.w500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh_rounded, size: 18, color: Colors.white54),
                      onPressed: _load,
                      tooltip: '刷新',
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18, color: Colors.white54),
                      onPressed: () => Navigator.pop(context),
                      tooltip: '关闭',
                    ),
                  ],
                ),
              ),

              // 搜索栏（精简轻量）
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 2, 14, 8),
                child: TextField(
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: '搜地方、搜人名（如：酒楼、长街、采云）',
                    hintStyle: const TextStyle(color: Colors.white24, fontSize: 12),
                    prefixIcon: const Icon(Icons.search_rounded, size: 16, color: Colors.white38),
                    suffixIcon: _query.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.close_rounded, size: 14, color: Colors.white38),
                            onPressed: () => setState(() => _query = ''),
                          ),
                    filled: true,
                    fillColor: Colors.white.withValues(alpha: 0.05),
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                  onChanged: (v) => setState(() => _query = v.trim()),
                ),
              ),

              // Tab 切换条
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: TabBar(
                  controller: _tab,
                  indicatorSize: TabBarIndicatorSize.tab,
                  indicator: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.5)),
                  ),
                  labelColor: const Color(0xFFDDD6FE),
                  unselectedLabelColor: Colors.white54,
                  labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  tabs: const [
                    Tab(text: '去哪儿 · 漫步'),
                    Tab(text: '找人 · 寻访'),
                    Tab(text: '待办 · 契约'),
                  ],
                ),
              ),

              const SizedBox(height: 6),

              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF8B5CF6)))
                    : TabBarView(
                        controller: _tab,
                        children: [
                          _buildPlacesTab(d),
                          _buildPeopleTab(d),
                          _todos(d),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1. 去哪儿 TAB（快捷磁贴 + 热门市井 + 场景分类）
  // ─────────────────────────────────────────────────────────────

  Widget _buildPlacesTab(Map<String, dynamic>? d) {
    final places = ((d?['places'] as List?) ?? const []).cast<Map>();
    final homes = ((d?['homes'] as List?) ?? const []).cast<Map>();

    bool hit(Map m) {
      if (_query.isEmpty) return true;
      final q = _query;
      final hay = '${m['name'] ?? ''}${m['role'] ?? ''}${m['place'] ?? ''}${(m['names'] as List?)?.join('') ?? ''}';
      return hay.contains(q);
    }

    final filteredPlaces = places.where(hit).toList();
    final filteredHomes = homes.where(hit).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 16),
      children: [
        // 顶部常用快捷磁贴（一键回宅 / 去大酒楼 / 赴茶坊 / 上街溜达）
        if (_query.isEmpty) ...[
          const Padding(
            padding: EdgeInsets.only(left: 2, bottom: 6),
            child: Text('常驻捷径 · 一键直达', style: TextStyle(fontSize: 11.5, color: Colors.white38)),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _quickTile(
                  icon: Icons.home_rounded,
                  title: '回王宅',
                  subtitle: '正房内寝',
                  color: const Color(0xFFC084FC),
                  onTap: () => _run(() => _goTo('临江·王宅·正房'), '（你步入七进大宅正房内寝。）'),
                ),
                _quickTile(
                  icon: Icons.storefront_rounded,
                  title: '去大酒楼',
                  subtitle: '运河三层',
                  color: const Color(0xFFFBBF24),
                  onTap: _showRestaurantFloorPicker,
                ),
                _quickTile(
                  icon: Icons.local_cafe_rounded,
                  title: '临江茶坊',
                  subtitle: '祖传老店',
                  color: const Color(0xFF34D399),
                  onTap: () => _run(() => _goTo('临江茶坊老店'), '（你踱步回祖传茶坊柜台。）'),
                ),
                _quickTile(
                  icon: Icons.directions_walk_rounded,
                  title: '上街溜达',
                  subtitle: '繁华市井',
                  color: const Color(0xFF60A5FA),
                  onTap: () => _run(() => _goTo('临江长街'), '（你信步来到市井长街，看两旁人来人往。）'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        // 场景分类胶囊条
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _filterChip('all', '全部街市', Icons.explore_outlined),
              _filterChip('hot', '🔥 有人气的街肆', Icons.local_fire_department_rounded),
              _filterChip('estate', '💼 我的产业', Icons.account_balance_wallet_outlined),
              _filterChip('market', '🏮 市井勾栏', Icons.nightlife_rounded),
              _filterChip('court', '🏛️ 衙署名胜', Icons.account_balance_outlined),
            ],
          ),
        ),
        const SizedBox(height: 10),

        // 按分类渲染列表
        ..._renderPlaceSections(filteredHomes, filteredPlaces),
      ],
    );
  }

  Widget _quickTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 96,
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 22, color: color),
              const SizedBox(height: 4),
              Text(title, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w600)),
              Text(subtitle, style: const TextStyle(color: Colors.white38, fontSize: 10.5)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _filterChip(String key, String label, IconData icon) {
    final active = _placeFilter == key;
    return Container(
      margin: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () => setState(() => _placeFilter = key),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: active ? const Color(0xFF8B5CF6).withValues(alpha: 0.25) : Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: active ? const Color(0xFF8B5CF6).withValues(alpha: 0.6) : Colors.white12,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 13, color: active ? const Color(0xFFDDD6FE) : Colors.white54),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11.5,
                  color: active ? const Color(0xFFDDD6FE) : Colors.white70,
                  fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _renderPlaceSections(List<Map> homes, List<Map> places) {
    final list = <Widget>[];

    // 1. 如果选了产业
    if (_placeFilter == 'estate' || _placeFilter == 'all') {
      if (homes.isNotEmpty) {
        list.add(const Padding(
          padding: EdgeInsets.only(left: 2, top: 4, bottom: 6),
          child: Text('💼 旗下名产（自有产业）', style: TextStyle(fontSize: 12, color: Colors.white38, fontWeight: FontWeight.w500)),
        ));
        for (final h in homes) {
          final name = (h['name'] ?? '').toString();
          final income = h['income'] ?? 0;
          final rooms = (h['rooms'] as List?)?.cast<Map>() ?? const [];
          list.add(_placeCard(
            name: name,
            subtitle: '日入 $income 两',
            icon: Icons.account_balance_wallet_rounded,
            badge: '我的产业',
            badgeColor: const Color(0xFFFBBF24),
            actionText: '过去',
            onTap: () => _run(() => _goTo(name), '（你走到了「$name」。）'),
            subRooms: rooms,
          ));
        }
      }
    }

    // 2. 筛选公共地点
    List<Map> filteredPlaces = places;
    if (_placeFilter == 'hot') {
      // 只要有人在的地方
      filteredPlaces = places.where((p) => ((p['names'] as List?)?.isNotEmpty ?? false)).toList();
    } else if (_placeFilter == 'market') {
      // 勾栏市井：客栈、赌坊、青楼、糖铺、衣庄等
      final re = RegExp(r'楼|坊|肆|客栈|赌|糖|庄|店|铺|长街|市井');
      filteredPlaces = places.where((p) => re.hasMatch((p['name'] ?? '').toString())).toList();
    } else if (_placeFilter == 'court') {
      // 衙署名胜：府衙、县衙、巡检、书院、庙、码头、茶山
      final re = RegExp(r'衙|院|庙|山|司|码头|渡口');
      filteredPlaces = places.where((p) => re.hasMatch((p['name'] ?? '').toString())).toList();
    }

    if (_placeFilter != 'estate' && filteredPlaces.isNotEmpty) {
      final title = _placeFilter == 'hot'
          ? '🔥 人气市井（有人在街上晃悠）'
          : (_placeFilter == 'market' ? '🏮 市井勾栏名铺' : (_placeFilter == 'court' ? '🏛️ 衙署名胜古刹' : '🚶 市井名胜各地'));
      list.add(Padding(
        padding: const EdgeInsets.only(left: 2, top: 8, bottom: 6),
        child: Text(title, style: const TextStyle(fontSize: 12, color: Colors.white38, fontWeight: FontWeight.w500)),
      ));

      for (final p in filteredPlaces) {
        final name = (p['name'] ?? '').toString();
        final names = (p['names'] as List?)?.cast<String>() ?? [];
        final hasPeople = names.isNotEmpty;
        final icon = _inferPlaceIcon(name);

        list.add(_placeCard(
          name: name,
          subtitle: hasPeople ? '${names.join('、')} 在此' : '市井清静',
          icon: icon,
          hasPeople: hasPeople,
          actionText: '前往',
          onTap: () => _run(() => _goTo(name), '（你走到了「$name」。）'),
        ));
      }
    }

    if (list.isEmpty) {
      list.add(const Padding(
        padding: EdgeInsets.symmetric(vertical: 36),
        child: Center(child: Text('没有符合条件的去处', style: TextStyle(color: Colors.white38, fontSize: 13))),
      ));
    }

    return list;
  }

  IconData _inferPlaceIcon(String name) {
    if (name.contains('茶')) return Icons.local_cafe_rounded;
    if (RegExp(r'酒|肆|宴|楼').hasMatch(name)) return Icons.storefront_rounded;
    if (RegExp(r'街|巷|市').hasMatch(name)) return Icons.directions_walk_rounded;
    if (RegExp(r'码头|渡|河|船').hasMatch(name)) return Icons.sailing_rounded;
    if (RegExp(r'衙|司|署').hasMatch(name)) return Icons.account_balance_rounded;
    if (RegExp(r'书院|堂|学').hasMatch(name)) return Icons.menu_book_rounded;
    if (RegExp(r'庙|观|寺').hasMatch(name)) return Icons.temple_buddhist_rounded;
    if (RegExp(r'客栈|邸').hasMatch(name)) return Icons.hotel_rounded;
    return Icons.location_on_rounded;
  }

  void _showRestaurantFloorPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF171A21),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final floors = [
          {'name': '一层大堂', 'desc': '一楼迎宾散座，青石铺地，伙计穿梭跑堂', 'icon': Icons.store_rounded},
          {'name': '二层雅阁', 'desc': '临河雅座，茶香酒暖，过往客商饮酒议事', 'icon': Icons.table_restaurant_rounded},
          {'name': '三层天字阁', 'desc': '至尊包席雅间，朱漆雕栏，饱览运河千帆', 'icon': Icons.stars_rounded},
          {'name': '清幽雅间', 'desc': '独立清幽小筑，隔音极佳，专供拉人密谈私会', 'icon': Icons.meeting_room_rounded},
          {'name': '内账房', 'desc': '清点银钱重地，周账房常年在此核对流水', 'icon': Icons.calculate_rounded},
        ];
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('运河码头三层大酒楼 · 雅阁与单间', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                    IconButton(
                      icon: const Icon(Icons.close, size: 18, color: Colors.white54),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text('整座三层酒楼皆为东家私产，请选定欲前往之雅阁单间：', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
                const SizedBox(height: 10),
                ...floors.map((f) => InkWell(
                  onTap: () {
                    Navigator.pop(ctx);
                    final fullName = '运河码头三层大酒楼·${f['name']}';
                    _run(() => _goTo(fullName), '（你来到运河大酒楼「${f['name']}」。）');
                  },
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                    ),
                    child: Row(
                      children: [
                        Icon(f['icon'] as IconData, size: 20, color: const Color(0xFFFBBF24)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(f['name'] as String, style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 2),
                              Text(f['desc'] as String, style: const TextStyle(color: Colors.white38, fontSize: 11)),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Colors.white24),
                      ],
                    ),
                  ),
                )),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _placeCard({
    required String name,
    required String subtitle,
    required IconData icon,
    String? badge,
    Color? badgeColor,
    bool hasPeople = false,
    required String actionText,
    required VoidCallback onTap,
    List<Map> subRooms = const [],
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: hasPeople ? 0.06 : 0.035),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasPeople ? const Color(0xFFF59E0B).withValues(alpha: 0.25) : Colors.white.withValues(alpha: 0.05),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: (hasPeople ? const Color(0xFFF59E0B) : const Color(0xFF8B5CF6)).withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 18, color: hasPeople ? const Color(0xFFFBBF24) : const Color(0xFFA78BFA)),
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
                            style: const TextStyle(fontSize: 13.5, color: Colors.white, fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: (badgeColor ?? const Color(0xFF8B5CF6)).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              badge,
                              style: TextStyle(fontSize: 10, color: badgeColor ?? const Color(0xFFDDD6FE)),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 11.5,
                        color: hasPeople ? const Color(0xFFFBBF24) : Colors.white38,
                        fontWeight: hasPeople ? FontWeight.w500 : FontWeight.normal,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              InkWell(
                onTap: onTap,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    actionText,
                    style: const TextStyle(color: Color(0xFFDDD6FE), fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),

          // 如果该产业旗下有各个雅间、楼层、单间，直接呈现药丸直达条
          if (subRooms.isNotEmpty) ...[
            const SizedBox(height: 6),
            const Divider(height: 1, color: Colors.white10),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 5,
              children: subRooms.map((r) {
                final rName = (r['name'] ?? '').toString();
                final fullTarget = '$name·$rName';
                return InkWell(
                  onTap: () => _run(() => _goTo(fullTarget), '（你来到$name「$rName」。）'),
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2E1065).withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.meeting_room_outlined, size: 11, color: Color(0xFFA78BFA)),
                        const SizedBox(width: 4),
                        Text(
                          rName,
                          style: const TextStyle(fontSize: 11, color: Color(0xFFDDD6FE)),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. 找人 TAB（亲眷快捷圆圈 + 圈子标签秒切 + 行踪定位）
  // ─────────────────────────────────────────────────────────────

  Widget _buildPeopleTab(Map<String, dynamic>? d) {
    final people = ((d?['people'] as List?) ?? const []).cast<Map>();

    bool hitP(Map m) {
      if (_query.isEmpty) return true;
      final q = _query;
      return '${m['name'] ?? ''}${m['role'] ?? ''}${m['place'] ?? ''}'.contains(q);
    }

    final filtered = people.where(hitP).toList();

    // 常用核心亲眷（沈婉儿、林芸娘、小翠、崔婉宁、杨采云等）
    final coreRe = RegExp(r'婉儿|芸娘|小翠|婉宁|采云|紫嫣|映雪|有福');
    final corePeople = people.where((p) {
      final n = (p['name'] ?? '').toString();
      return coreRe.hasMatch(n);
    }).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 16),
      children: [
        // 顶部核心内眷红颜快捷头像栏
        if (_query.isEmpty && corePeople.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.only(left: 2, bottom: 6),
            child: Text('常伴左右 · 亲眷挚友', style: TextStyle(fontSize: 11.5, color: Colors.white38)),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: corePeople.map((p) => _avatarTile(p)).toList(),
            ),
          ),
          const SizedBox(height: 12),
        ],

        // 查阅城中人物名录与好感羁绊入口
        Container(
          margin: const EdgeInsets.only(bottom: 10),
          child: InkWell(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => RosterScreen(
                    api: widget.api,
                    onActionMessage: (msg) {
                      _run(() async => true, msg);
                    },
                  ),
                ),
              );
            },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF6D28D9).withValues(alpha: 0.35),
                    const Color(0xFF1E1B4B).withValues(alpha: 0.5),
                  ],
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.people_alt_rounded, size: 16, color: Color(0xFFDDD6FE)),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '城中世情志 · 人物好感名录',
                          style: TextStyle(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w600),
                        ),
                        SizedBox(height: 1),
                        Text(
                          '按府县查阅全城人物 · 信任欲望怨怼心性与态度评语',
                          style: TextStyle(fontSize: 10.5, color: Color(0xFFC4B5FD)),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_forward_ios_rounded, size: 13, color: Color(0xFFA78BFA)),
                ],
              ),
            ),
          ),
        ),

        // 圈子分类胶囊
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _peopleFilterChip('all', '全部人物'),
              _peopleFilterChip('family', '内眷妻妾'),
              _peopleFilterChip('confidant', '红颜知交'),
              _peopleFilterChip('official', '官府权贵'),
              _peopleFilterChip('gentry', '名流士绅'),
              _peopleFilterChip('manager', '产业掌柜'),
            ],
          ),
        ),
        const SizedBox(height: 10),

        // 人员列表
        ..._renderPeopleList(filtered),
      ],
    );
  }

  Widget _avatarTile(Map p) {
    final name = (p['name'] ?? '').toString();
    final shortName = name.length > 2 ? name.substring(name.length - 1) : name;
    final here = p['here'] == true;
    final role = (p['role'] ?? '').toString();
    final placeName = (p['place'] ?? '').toString();
    final isMale = (p['gender'] ?? '') == 'male';
    final he = isMale ? '他' : '她';

    Color ringColor = const Color(0xFFC084FC);
    if (role.contains('正妻')) {
      ringColor = const Color(0xFFFBBF24);
    } else if (RegExp(r'二房|妾|如夫人').hasMatch(role)) {
      ringColor = const Color(0xFFF472B6);
    } else if (role.contains('丫鬟')) {
      ringColor = const Color(0xFF34D399);
    } else if (role.contains('掌柜')) {
      ringColor = const Color(0xFF60A5FA);
    }

    return Container(
      margin: const EdgeInsets.only(right: 12),
      child: InkWell(
        onTap: () {
          if (here) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('（$name 就在跟前相伴。）'), duration: const Duration(seconds: 1)),
            );
          } else {
            // 弹出轻量菜单
            showModalBottomSheet(
              context: context,
              backgroundColor: const Color(0xFF1E2230),
              shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
              builder: (_) => SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('$name · $role', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text('此刻在：$placeName', style: const TextStyle(color: Colors.white54, fontSize: 12.5)),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF8B5CF6),
                                foregroundColor: Colors.white,
                              ),
                              icon: const Icon(Icons.directions_walk_rounded, size: 16),
                              label: Text('去$he这'),
                              onPressed: () {
                                Navigator.pop(context);
                                _run(() => _findPerson(p), '（你去找$name了。）');
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          if (p['canSummon'] != false)
                            Expanded(
                              child: OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFFDDD6FE),
                                  side: const BorderSide(color: Color(0xFF8B5CF6)),
                                ),
                                icon: const Icon(Icons.call_made_rounded, size: 16),
                                label: Text('叫$he来'),
                                onPressed: () {
                                  Navigator.pop(context);
                                  _run(() => widget.api.summon((p['id'] ?? '').toString()), '（$name应声赶来。）');
                                },
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          }
        },
        borderRadius: BorderRadius.circular(30),
        child: Column(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ringColor.withValues(alpha: 0.15),
                    border: Border.all(color: ringColor, width: 1.5),
                  ),
                  child: Center(
                    child: Text(
                      shortName,
                      style: TextStyle(color: ringColor, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                if (here)
                  Positioned(
                    right: -1,
                    bottom: -1,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: const Color(0xFF22C55E),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF10121A), width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              name,
              style: const TextStyle(color: Colors.white70, fontSize: 11),
            ),
            Text(
              here ? '在跟前' : (placeName.split('·').last.replaceAll('（七进大宅）', '')),
              style: TextStyle(
                color: here ? const Color(0xFF22C55E) : Colors.white38,
                fontSize: 9.5,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _peopleFilterChip(String key, String label) {
    final active = _peopleFilter == key;
    return Container(
      margin: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () => setState(() => _peopleFilter = key),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: active ? const Color(0xFF8B5CF6).withValues(alpha: 0.25) : Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: active ? const Color(0xFF8B5CF6).withValues(alpha: 0.6) : Colors.white12,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              color: active ? const Color(0xFFDDD6FE) : Colors.white70,
              fontWeight: active ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _renderPeopleList(List<Map> people) {
    List<Map> list = people;

    if (_peopleFilter == 'family') {
      final re = RegExp(r'妻|妾|房|丫鬟|王宅|正房|夫人|眷属');
      list = people.where((p) => re.hasMatch('${p['role']} ${p['group']}')).toList();
    } else if (_peopleFilter == 'confidant') {
      final re = RegExp(r'知己|相好|客卿|乐师|采云|紫嫣|映雪|如烟|红颜');
      list = people.where((p) => re.hasMatch('${p['role']} ${p['name']} ${p['group']}')).toList();
    } else if (_peopleFilter == 'official') {
      final re = RegExp(r'知府|县令|知县|巡检|大人|巡按|巡抚|官员|县丞|主簿|通判|同知|官府|权贵');
      list = people.where((p) => re.hasMatch('${p['role']} ${p['name']} ${p['group']}')).toList();
    } else if (_peopleFilter == 'gentry') {
      final re = RegExp(r'老爷|士绅|富商|名门|巨贾|盐商|总商|崔府|杨府|举人|进士|夫子|先生|名士|闺秀|公子');
      list = people.where((p) => re.hasMatch('${p['role']} ${p['name']} ${p['group']}')).toList();
    } else if (_peopleFilter == 'manager') {
      final re = RegExp(r'掌柜|账房|大厨|跑堂|伙计|茶坊|酒楼|货栈|书办|主事|产业');
      list = people.where((p) => re.hasMatch('${p['role']} ${p['name']} ${p['group']}')).toList();
    }

    if (list.isEmpty) {
      return [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 36),
          child: Center(child: Text('没有该分类下的人物', style: TextStyle(color: Colors.white38, fontSize: 13))),
        ),
      ];
    }

    return list.map((p) {
      final here = p['here'] == true;
      final canSummon = p['canSummon'] != false;
      final isMale = (p['gender'] ?? '') == 'male';
      final he = isMale ? '他' : '她';
      final placeName = (p['place'] ?? '').toString();
      final name = (p['name'] ?? '').toString();
      final role = (p['role'] ?? '').toString();

      return Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: here ? 0.06 : 0.035),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: here ? const Color(0xFF22C55E).withValues(alpha: 0.3) : Colors.white.withValues(alpha: 0.05),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
              ),
              child: Center(
                child: Text(
                  name.isNotEmpty ? name.substring(0, 1) : '人',
                  style: const TextStyle(color: Color(0xFFDDD6FE), fontSize: 14, fontWeight: FontWeight.bold),
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
                      Text(name, style: const TextStyle(fontSize: 13.5, color: Colors.white, fontWeight: FontWeight.w600)),
                      if (role.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(role, style: const TextStyle(fontSize: 10, color: Colors.white60)),
                        ),
                      ],
                      if (p['group'] != null && (p['group'] ?? '').toString().isNotEmpty && !['其他人', '市井百态'].contains(p['group'])) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4.5, vertical: 1),
                          decoration: BoxDecoration(
                            color: p['group'] == '官府权贵'
                                ? const Color(0xFFEF4444).withValues(alpha: 0.15)
                                : (p['group'] == '名流士绅'
                                    ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                                    : const Color(0xFF8B5CF6).withValues(alpha: 0.15)),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color: p['group'] == '官府权贵'
                                  ? const Color(0xFFEF4444).withValues(alpha: 0.35)
                                  : (p['group'] == '名流士绅'
                                      ? const Color(0xFFF59E0B).withValues(alpha: 0.35)
                                      : const Color(0xFF8B5CF6).withValues(alpha: 0.35)),
                              width: 0.6,
                            ),
                          ),
                          child: Text(
                            p['group'].toString(),
                            style: TextStyle(
                              fontSize: 9.5,
                              color: p['group'] == '官府权贵'
                                  ? const Color(0xFFFCA5A5)
                                  : (p['group'] == '名流士绅'
                                      ? const Color(0xFFFCD34D)
                                      : const Color(0xFFDDD6FE)),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    here ? '✨ 就在跟前' : '📍 $placeName',
                    style: TextStyle(
                      fontSize: 11.5,
                      color: here ? const Color(0xFF22C55E) : Colors.white38,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (here)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('在跟前', style: TextStyle(fontSize: 11.5, color: Color(0xFF22C55E), fontWeight: FontWeight.w600)),
              )
            else
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  InkWell(
                    onTap: () => _run(() => _findPerson(p), '（你去找$name了。）'),
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF8B5CF6).withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.35)),
                      ),
                      child: Text('去$he这', style: const TextStyle(color: Color(0xFFDDD6FE), fontSize: 11.5, fontWeight: FontWeight.w500)),
                    ),
                  ),
                  if (canSummon) ...[
                    const SizedBox(width: 6),
                    InkWell(
                      onTap: () => _run(() => widget.api.summon((p['id'] ?? '').toString()), '（$name应声赶来。）'),
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.white12),
                        ),
                        child: Text('叫$he来', style: const TextStyle(color: Colors.white70, fontSize: 11.5, fontWeight: FontWeight.w500)),
                      ),
                    ),
                  ],
                ],
              ),
          ],
        ),
      );
    }).toList();
  }

  // ─────────────────────────────────────────────────────────────
  // 3. 待办 TAB
  // ─────────────────────────────────────────────────────────────

  Widget _todos(Map<String, dynamic>? d) {
    final todos = (d?['todos'] as List?) ?? const [];
    if (todos.isEmpty) {
      return const Center(child: Text('暂无约定与承诺字据', style: TextStyle(color: Colors.white38, fontSize: 13)));
    }
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      children: todos.map((x) {
        final id = (x['id'] ?? '').toString();
        final place = (x['placeName'] ?? '').toString();
        final overdue = x['overdue'] == true;
        final sub = [
          if (place.isNotEmpty) '在$place',
          (x['text'] ?? '').toString(),
          if (overdue) '（已过期）',
        ].where((e) => e.isNotEmpty).join(' · ');
        return Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${x['kind']} · ${x['when'] ?? ''} ${x['who'] ?? ''}',
                      style: const TextStyle(fontSize: 13, color: Colors.white, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      sub,
                      style: const TextStyle(fontSize: 11, color: Colors.white38),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextButton(
                    onPressed: () => _run(() => _todo(id, 'do'), '（办了。）'),
                    child: const Text('去做', style: TextStyle(fontSize: 12)),
                  ),
                  TextButton(
                    onPressed: () => _run(() => _todo(id, 'later'), '（改天。）'),
                    child: const Text('改天', style: TextStyle(color: Colors.white54, fontSize: 12)),
                  ),
                  TextButton(
                    onPressed: () => _run(() => _todo(id, 'drop'), '（推了。）'),
                    child: const Text('推掉', style: TextStyle(color: Colors.white38, fontSize: 12)),
                  ),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
