import io

p = 'mobile/lib/views/out_and_about_sheet.dart'
d = io.open(p, encoding='utf-8').read()
changed = []

# ① 状态：搜索词
if '_query' not in d:
    d = d.replace("  bool _busy = false;",
                  "  bool _busy = false;\n  String _query = '';", 1)
    changed.append('搜索状态')

# ② 顶部加搜索框（放在 TabBar 之前）
old = """            TabBar(
              controller: _tab,"""
new = """            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 6),
              child: TextField(
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  isDense: true,
                  hintText: '搜地方、搜人（如：货栈 / 采云）',
                  hintStyle: const TextStyle(color: Colors.white24, fontSize: 12.5),
                  prefixIcon: const Icon(Icons.search_rounded, size: 17, color: Colors.white38),
                  suffixIcon: _query.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close_rounded, size: 15, color: Colors.white38),
                          onPressed: () => setState(() => _query = ''),
                        ),
                  filled: true,
                  fillColor: Colors.white.withValues(alpha: 0.06),
                  contentPadding: const EdgeInsets.symmetric(vertical: 8),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(9), borderSide: BorderSide.none),
                ),
                onChanged: (v) => setState(() => _query = v.trim()),
              ),
            ),
            TabBar(
              controller: _tab,"""
if old in d and '搜地方、搜人' not in d:
    d = d.replace(old, new, 1)
    changed.append('搜索框 UI')

# ③ 地点列表过滤
old2 = """    final places = (d?['places'] as List?) ?? const [];
    final homes = (d?['homes'] as List?) ?? const [];"""
new2 = """    bool hit(Map m) {
      if (_query.isEmpty) return true;
      final q = _query;
      final hay = '${m['name'] ?? ''}${m['role'] ?? ''}${m['place'] ?? ''}${(m['names'] as List?)?.join('') ?? ''}';
      return hay.contains(q);
    }

    final places = ((d?['places'] as List?) ?? const []).where((x) => x is Map && hit(x)).toList();
    final homes = ((d?['homes'] as List?) ?? const []).where((x) => x is Map && hit(x)).toList();"""
if old2 in d:
    d = d.replace(old2, new2, 1)
    changed.append('地点过滤')

# ④ 人员列表过滤 + 分组顺序加"常来往"
old3 = """    final people = (d?['people'] as List?) ?? const [];
    if (people.isEmpty) {"""
new3 = """    bool hitP(Map m) {
      if (_query.isEmpty) return true;
      final q = _query;
      return '${m['name'] ?? ''}${m['role'] ?? ''}${m['place'] ?? ''}'.contains(q);
    }

    final people = ((d?['people'] as List?) ?? const []).where((x) => x is Map && hitP(x)).toList();
    if (people.isEmpty) {"""
if old3 in d:
    d = d.replace(old3, new3, 1)
    changed.append('人员过滤')

d = d.replace("final order = ['我的人', '府内', '王家', '相好', '其他人'];",
              "final order = ['我的人', '府内', '王家', '相好', '常来往', '其他人'];")

# ⑤ 空态提示更清楚
d = d.replace("return const Center(child: Text('附近没什么地方可去', style: TextStyle(color: Colors.white54)));",
              "return Center(child: Text(_query.isEmpty ? '没有可去的地方' : '没搜到「$_query」', style: const TextStyle(color: Colors.white54)));")
d = d.replace("return const Center(child: Text('世上没别人', style: TextStyle(color: Colors.white54)));",
              "return Center(child: Text(_query.isEmpty ? '世上没别人' : '没搜到「$_query」', style: const TextStyle(color: Colors.white54)));")

io.open(p, 'w', encoding='utf-8').write(d)
print('改动:', '、'.join(changed) if changed else '无')
