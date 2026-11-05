import io
p = 'mobile/lib/widgets/message_bubble.dart'
s = io.open(p, encoding='utf-8').read()
old = """    // 7. 通用市井伴侣 / 客卿（名字哈希古典色调）"""
new = """    // 6.5 服务端给了身份前缀（如「帮工·鲁青」）：按身份做标题，不再一律叫"客卿"
    final sep = s.contains('·') ? '·' : (s.contains('・') ? '・' : null);
    if (sep != null) {
      final parts = s.split(sep);
      final t = parts.first.trim();
      final n = parts.sublist(1).join(sep).trim();
      if (t.isNotEmpty && n.isNotEmpty) {
        final palette2 = [Color(0xFF8B5CF6), Color(0xFFEC4899), Color(0xFF0EA5E9), Color(0xFFF59E0B), Color(0xFF10B981)];
        var h2 = 0;
        for (final c in t.codeUnits) {
          h2 = (h2 * 31 + c) & 0x7fffffff;
        }
        final pc2 = palette2[h2 % palette2.length];
        return _SpeakerMeta(
          raw: s,
          title: t,
          name: n,
          symbol: '🍵',
          primaryColor: pc2,
          secondaryColor: Color.lerp(pc2, Colors.black, 0.28)!,
        );
      }
    }

    // 7. 通用市井伴侣 / 客卿（名字哈希古典色调）"""
if old in s and '服务端给了身份前缀' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 气泡按"身份·名字"显示')
