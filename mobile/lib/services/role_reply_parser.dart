/// 分角剧本解析器
///
/// 服务端有时会返回「多角色同场」的剧本格式：
///   【沈婉儿】：相公回来了？
///   【跑堂伙计·阿吉】：掌柜的，茶备好了。
///
/// 这里把它拆成一条条独立对白，让每个角色成为独立气泡、独立名字、独立头像，
/// 而不是一整段糊在一起、名字永远是主角色。
class RoleSegment {
  /// 说话人；null 表示就是主角色本人
  final String? speaker;

  /// 这一段的纯净台词
  final String text;

  const RoleSegment({this.speaker, required this.text});

  bool get isMain => speaker == null;
}

class RoleReplyParser {
  /// 【名字】开头（允许紧跟冒号/不跟冒号）
  static final RegExp _bracketMarker =
      RegExp(r'^\s*(?:\*\*)?[【\[]\s*([^】\]\n]{1,16}?)\s*[】\]]\s*[*]{0,2}\s*[:：]?\s*');

  /// **名字**：开头
  static final RegExp _boldMarker =
      RegExp(r'^\s*\*\*\s*([^*\n]{1,16}?)\s*\*\*\s*[:：]\s*');

  /// 行中出现的新说话人标记（用于把「【A】：…【B】：…」从一行拆开）
  static final RegExp _inlineSplit =
      RegExp(r'(?=【[^】\n]{1,16}】\s*[:：])');

  static List<RoleSegment> parse(String raw) {
    final source = raw.replaceAll('\r\n', '\n').trim();
    if (source.isEmpty) return const [RoleSegment(speaker: null, text: '')];

    // 先把同一行里的多个说话人标记拆到不同行
    final normalized = source.split(_inlineSplit).join('\n');
    final lines = normalized.split('\n');

    final segments = <RoleSegment>[];
    String? currentSpeaker;
    final buffer = <String>[];

    void flush() {
      final joined = buffer.join('\n').trim();
      if (joined.isNotEmpty) {
        segments.add(RoleSegment(speaker: currentSpeaker, text: _stripQuotes(joined)));
      }
      buffer.clear();
    }

    for (final line in lines) {
      final match = _bracketMarker.firstMatch(line) ?? _boldMarker.firstMatch(line);
      if (match != null) {
        flush();
        currentSpeaker = _cleanSpeaker(match.group(1));
        final rest = line.substring(match.end).trim();
        if (rest.isNotEmpty) buffer.add(rest);
      } else {
        buffer.add(line);
      }
    }
    flush();

    if (segments.isEmpty) {
      return [RoleSegment(speaker: null, text: source)];
    }
    return segments;
  }

  static String? _cleanSpeaker(String? name) {
    if (name == null) return null;
    var n = name.trim();
    // 去掉「主公」「主角」这类泛称，交回主角色处理；地名也绝不作为发言角色
    const generics = {'主角', '你', 'AI', '旁白', '众人', '天道', '系统', '环境'};
    if (n.isEmpty || generics.contains(n)) return null;
    if (RegExp(r'(县衙|男牢|女牢|牢房|酒肆|茶坊|酒楼|长街|码头|医馆|药铺|当铺|客栈|正房|后院|这里|此处)$').hasMatch(n)) {
      return null;
    }
    // 去掉「跑堂伙计·阿吉」里的前缀，只留人名（保留原名亦可，这里保留全称更适合显示）
    return n;
  }

  static String _stripQuotes(String text) {
    var t = text.trim();
    const pairs = [
      ['“', '”'],
      ['「', '」'],
      ['『', '』'],
      ['"', '"'],
    ];
    for (final p in pairs) {
      if (t.length >= 2 && t.startsWith(p[0]) && t.endsWith(p[1])) {
        t = t.substring(1, t.length - 1).trim();
      }
    }
    return t;
  }
}
