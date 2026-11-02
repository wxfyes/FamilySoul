import io

p = 'mobile/lib/views/my_world_screen.dart'
s = io.open(p, encoding='utf-8-sig').read()

# 1) 状态：行踪数据与搜索
s = s.replace(
    "  Map<String, dynamic>? _data;",
    "  Map<String, dynamic>? _data;\n  List<Map<String, dynamic>> _who = const [];\n  final TextEditingController _whoCtrl = TextEditingController();",
)
s = s.replace(
    "  Future<void> _load() async {\n    setState(() {\n      _loading = true;\n      _error = null;\n    });\n    final data = await widget.api.fetchMyWorld();",
    "  Future<void> _loadWho({String q = ''}) async {\n    final rows = await widget.api.fetchWho(q: q);\n    if (!mounted) return;\n    setState(() => _who = rows);\n  }\n\n  Future<void> _load() async {\n    setState(() {\n      _loading = true;\n      _error = null;\n    });\n    await _loadWho();\n    final data = await widget.api.fetchMyWorld();",
)
s = s.replace(
    "  @override\n  void initState() {\n    super.initState();\n    _load();\n  }",
    "  @override\n  void initState() {\n    super.initState();\n    _load();\n  }\n\n  @override\n  void dispose() {\n    _whoCtrl.dispose();\n    super.dispose();\n  }",
)

# 2) 界面：在「名声」之前插入行踪
anchor = "      // 名声\n"
who_section = (
    "      // 行踪：谁在哪\n"
    "      _sectionTitle('行踪（谁在哪）'),\n"
    "      _cardShell(\n"
    "        child: Column(\n"
    "          crossAxisAlignment: CrossAxisAlignment.start,\n"
    "          children: [\n"
    "            Row(\n"
    "              children: [\n"
    "                Expanded(\n"
    "                  child: TextField(\n"
    "                    controller: _whoCtrl,\n"
    "                    style: const TextStyle(color: Colors.white, fontSize: 13),\n"
    "                    decoration: InputDecoration(\n"
    "                      isDense: true,\n"
    "                      hintText: '搜名字或身份',\n"
    "                      hintStyle: const TextStyle(color: _muted, fontSize: 12),\n"
    "                      filled: true,\n"
    "                      fillColor: const Color(0xFF1B2029),\n"
    "                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),\n"
    "                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),\n"
    "                    ),\n"
    "                    onSubmitted: (v) => _loadWho(q: v.trim()),\n"
    "                  ),\n"
    "                ),\n"
    "                const SizedBox(width: 8),\n"
    "                TextButton(onPressed: () => _loadWho(q: _whoCtrl.text.trim()), child: const Text('查')),\n"
    "              ],\n"
    "            ),\n"
    "            const SizedBox(height: 6),\n"
    "            if (_who.isEmpty)\n"
    "              const Text('没找到人', style: TextStyle(color: _muted, fontSize: 12.5))\n"
    "            else\n"
    "              for (final w in _who)\n"
    "                Padding(\n"
    "                  padding: const EdgeInsets.symmetric(vertical: 5),\n"
    "                  child: Row(\n"
    "                    children: [\n"
    "                      if (w['here'] == true)\n"
    "                        const Padding(\n"
    "                          padding: EdgeInsets.only(right: 4),\n"
    "                          child: Icon(Icons.place, size: 13, color: Color(0xFF7BD88F)),\n"
    "                        ),\n"
    "                      Expanded(\n"
    "                        child: Text(\n"
    "                          '${w['name']}  ${w['role'] ?? ''}',\n"
    "                          style: const TextStyle(color: Color(0xFFDDE3EE), fontSize: 12.5),\n"
    "                          overflow: TextOverflow.ellipsis,\n"
    "                        ),\n"
    "                      ),\n"
    "                      Text('${w['place'] ?? ''}', style: const TextStyle(color: _muted, fontSize: 11.5)),\n"
    "                    ],\n"
    "                  ),\n"
    "                ),\n"
    "          ],\n"
    "        ),\n"
    "      ),\n\n"
    "      // 名声\n"
)
if anchor in s and "行踪（谁在哪）" not in s:
    s = s.replace(anchor, who_section, 1)
    print('added who section')
else:
    print('WARN: 名声 anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
