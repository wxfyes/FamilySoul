import io

# ① api_client：goTo 返回到达提示
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
old = """  /// 我去某处
  Future<bool> goTo(String place) async {
    try {
      final res = await _dio.post('${config.baseUrl}/api/world/go',
          queryParameters: {'token': config.token.trim()},
          data: {'place': place});
      return res.statusCode == 200 && (res.data is Map) && res.data['ok'] == true;
    } catch (_) {}
    return false;
  }"""
new = """  /// 我去某处：成功返回"（你到了「X」。此处：…）"这句提示，失败返回 null
  Future<String?> goTo(String place) async {
    try {
      final res = await _dio.post('${config.baseUrl}/api/world/go',
          queryParameters: {'token': config.token.trim()},
          data: {'place': place});
      if (res.statusCode == 200 && (res.data is Map) && res.data['ok'] == true) {
        final line = res.data['line'];
        return line is String && line.isNotEmpty ? line : '（你到了「${res.data['place'] ?? place}」。）';
      }
    } catch (_) {}
    return null;
  }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① goTo 返回到达提示')
else:
    print('WARN: goTo 没匹配')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 抽屉：用服务端返回的整行做提示
p2 = 'mobile/lib/views/out_and_about_sheet.dart'
d = io.open(p2, encoding='utf-8').read()

old2 = """  Future<void> _run(Future<bool> Function() action, String okText) async {
    if (_busy) return;
    setState(() => _busy = true);
    HapticFeedback.lightImpact();
    final ok = await action();
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(okText), duration: const Duration(milliseconds: 1200), behavior: SnackBarBehavior.floating),
      );
      widget.onChanged?.call();
      await _load();
    }
  }"""
new2 = """  Future<void> _run(Future<bool> Function() action, String okText) async {
    if (_busy) return;
    setState(() => _busy = true);
    HapticFeedback.lightImpact();
    final ok = await action();
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      final text = (_serverLine != null && _serverLine!.isNotEmpty) ? _serverLine! : okText;
      _serverLine = null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(text), duration: const Duration(milliseconds: 2200), behavior: SnackBarBehavior.floating),
      );
      widget.onChanged?.call();
      await _load();
    }
  }

  String? _serverLine;

  /// 去某地：把服务端的"到达提示"接住
  Future<bool> _goTo(String place) async {
    final line = await widget.api.goTo(place);
    if (line == null) return false;
    _serverLine = line;
    return true;
  }"""
if old2 in d:
    d = d.replace(old2, new2, 1)
    print('② 抽屉接住到达提示')

# ③ 所有 goTo 调用改成 _goTo
d = d.replace("() => _run(() => widget.api.goTo((h['name'] ?? '').toString()), '（你走到了「${h['name']}」。）')",
              "() => _run(() => _goTo((h['name'] ?? '').toString()), '（你走到了「${h['name']}」。）')")
d = d.replace("() => _run(() => widget.api.goTo((p['name'] ?? '').toString()), '（你走到了「${p['name']}」。）')",
              "() => _run(() => _goTo((p['name'] ?? '').toString()), '（你走到了「${p['name']}」。）')")
d = d.replace(": () => _run(() => widget.api.goTo(placeName), '（你去找${p['name']}了。）'),",
              ": () => _run(() => _goTo(placeName), '（你去找${p['name']}了。）'),")
print('③ goTo 调用已切换')
io.open(p2, 'w', encoding='utf-8').write(d)
print('done')
