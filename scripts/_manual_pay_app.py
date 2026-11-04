import io
# ① api_client：手动付账
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
if 'payManual' not in s:
    add = '''
  /// 手动记一笔花销
  Future<String?> payManual(double amount, String title) async {
    try {
      final res = await _dio.post('${config.baseUrl}/api/world/pay',
          queryParameters: {'token': config.token.trim()},
          data: {'amount': amount, 'title': title});
      if (res.statusCode == 200 && res.data is Map) {
        if (res.data['ok'] == true) return (res.data['line'] ?? '（已付。）').toString();
        final err = res.data['error'];
        if (err is String) return '（$err）';
      }
    } catch (_) {}
    return null;
  }
}
'''
    idx = s.rfind('}')
    s = s[:idx] + add.lstrip('\n')
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 加 payManual')

# ② 抽屉里加"记一笔花销"
p2 = 'mobile/lib/views/chat_screen.dart'
d = io.open(p2, encoding='utf-8').read()
anchor = """            ListTile(
              leading: const Icon(Icons.public_rounded, color: Colors.white70),
              title: const Text('我的世界', style: TextStyle(color: Colors.white)),"""
block = """            ListTile(
              leading: const Icon(Icons.payments_rounded, color: Color(0xFFE0B252)),
              title: const Text('记一笔花销', style: TextStyle(color: Colors.white)),
              subtitle: const Text('房钱 · 货款 · 打点 · 赏银', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
              onTap: () async {
                Navigator.pop(context);
                final ctrlA = TextEditingController();
                final ctrlT = TextEditingController(text: '花销');
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: const Color(0xFF1B1E28),
                    title: const Text('记一笔花销', style: TextStyle(color: Colors.white, fontSize: 16)),
                    content: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          controller: ctrlT,
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(labelText: '名目', labelStyle: TextStyle(color: Colors.white38)),
                        ),
                        TextField(
                          controller: ctrlA,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(labelText: '银子（两）', labelStyle: TextStyle(color: Colors.white38)),
                        ),
                      ],
                    ),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('算了')),
                      TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('付')),
                    ],
                  ),
                );
                if (ok != true) return;
                final amount = double.tryParse(ctrlA.text.trim()) ?? 0;
                final title = ctrlT.text.trim().isEmpty ? '花销' : ctrlT.text.trim();
                final line = await provider.api.payManual(amount, title);
                if (!mounted) return;
                if (line != null) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(line), duration: const Duration(milliseconds: 2200), behavior: SnackBarBehavior.floating),
                  );
                  _refreshPlace();
                }
              },
            ),
""" + anchor
if '记一笔花销' not in d:
    d = d.replace(anchor, block, 1)
    print('② 抽屉加记一笔花销')
io.open(p2, 'w', encoding='utf-8').write(d)
