import io

p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
changed = []

# ① 状态字段
anchor_state = "  String _currentLocaleId = 'zh_CN';"
if '_placeName' not in s:
    s = s.replace(anchor_state, anchor_state + """

  // 首页位置条：随时知道自己在哪
  String _placeName = '';
  int _worldDay = 0;
  int _worldHour = 0;
  Timer? _locTimer;""", 1)
    changed.append('状态字段')

# ② initState 里启动刷新
old_init = """  @override
  void initState() {
    super.initState();
    if (Platform.isAndroid) {"""
new_init = """  @override
  void initState() {
    super.initState();
    _refreshPlace();
    _locTimer = Timer.periodic(const Duration(seconds: 30), (_) => _refreshPlace());
    if (Platform.isAndroid) {"""
if old_init in s and '_refreshPlace();' not in s:
    s = s.replace(old_init, new_init, 1)
    changed.append('initState 定时刷新')

# ③ dispose 清理 + 刷新方法
anchor_dispose = "  @override\n  void dispose() {"
if anchor_dispose in s and 'void _refreshPlace' not in s:
    method = """  Future<void> _refreshPlace() async {
    try {
      final d = await context.read<ChatProvider>().api.fetchMyWorld();
      if (!mounted || d == null) return;
      final self = (d['self'] is Map) ? d['self'] as Map : const {};
      final date = (d['date'] is Map) ? d['date'] as Map : const {};
      final place = (self['place'] ?? '').toString();
      if (place.isEmpty) return;
      final day = (date['day'] ?? 0) is int ? date['day'] as int : int.tryParse('${date['day']}') ?? 0;
      final hour = (date['hour'] ?? 0) is int ? date['hour'] as int : int.tryParse('${date['hour']}') ?? 0;
      if (place != _placeName || day != _worldDay || hour != _worldHour) {
        setState(() {
          _placeName = place;
          _worldDay = day;
          _worldHour = hour;
        });
      }
    } catch (_) {}
  }

"""
    s = s.replace(anchor_dispose, method + anchor_dispose, 1)
    changed.append('刷新方法')

# dispose 里取消定时器
if '_locTimer?.cancel();' not in s:
    old_disp = "  void dispose() {\n"
    s = s.replace(old_disp, old_disp + "    _locTimer?.cancel();\n", 1)
    changed.append('dispose 取消定时器')

# ④ UI：位置条插在"未连接提示"之前
anchor_ui = """            Column(
              children: [
                if (!isOnline && provider.isInitialized)"""
new_ui = """            Column(
              children: [
                // 📍 位置条：随时知道自己在哪（点一下＝出门）
                if (_placeName.isNotEmpty)
                  InkWell(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => OutAndAboutSheet(api: provider.api, onChanged: _refreshPlace),
                      ).then((_) => _refreshPlace());
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      color: const Color(0xFF1B1E28),
                      child: Row(
                        children: [
                          const Icon(Icons.place_rounded, size: 15, color: Color(0xFF8B5CF6)),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              _placeName,
                              style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (_worldDay > 0)
                            Text(
                              '第$_worldDay日 $_worldHour时',
                              style: const TextStyle(color: Colors.white30, fontSize: 11.5),
                            ),
                          const SizedBox(width: 4),
                          const Icon(Icons.keyboard_arrow_right_rounded, size: 15, color: Colors.white24),
                        ],
                      ),
                    ),
                  ),
                if (!isOnline && provider.isInitialized)"""
if anchor_ui in s and '位置条：随时知道自己在哪' not in s:
    s = s.replace(anchor_ui, new_ui, 1)
    changed.append('位置条 UI')

io.open(p, 'w', encoding='utf-8').write(s)
print('改动:', '、'.join(changed) if changed else '无')
