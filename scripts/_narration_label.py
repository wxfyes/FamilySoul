import io
p = 'mobile/lib/widgets/message_bubble.dart'
s = io.open(p, encoding='utf-8').read()
# 旁白/天道 不该叫"客卿"
old = "    // 7. 通用市井伴侣 / 客卿（名字哈希古典色调）"
new = """    // 6.8 旁白 / 天道：是叙述，不是人
    if (s.contains('旁白') || s.contains('天道') || s.contains('众人')) {
      return _SpeakerMeta(
        raw: s,
        title: '旁白',
        name: '',
        symbol: '🕯️',
        primaryColor: const Color(0xFF64748B),
        secondaryColor: const Color(0xFF475569),
      );
    }

    // 7. 通用市井伴侣 / 客卿（名字哈希古典色调）"""
if old in s and "title: '旁白'" not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 旁白不再标客卿')
