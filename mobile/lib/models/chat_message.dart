class ChatMessage {
  final String id;
  final String text;
  final bool isUser;
  final DateTime timestamp;
  final String modality;
  final String? audioUrl;
  final String? emojiType;
  final String? localImagePath;
  final bool isError;
  final bool isPending;
  final List<String>? notices;

  /// 这一条是谁说的（分角剧本里的角色名）；null 表示主角色本人
  final String? speaker;

  /// 发言人所在地点/铺子（或信函来源地，例如「于家酒肆」）
  final String? place;

  /// 是否差人送来的口信/家书（消除隔空假象）
  final bool isLetter;

  ChatMessage({
    required this.id,
    required this.text,
    required this.isUser,
    required this.timestamp,
    this.modality = 'text',
    this.audioUrl,
    this.emojiType,
    this.localImagePath,
    this.isError = false,
    this.isPending = false,
    this.notices,
    this.speaker,
    this.place,
    this.isLetter = false,
  });

  /// 智能推导说话人：正文显式前缀【xxx】拥有最高真相权重（彻底防止外部默认账号名污染覆盖剧本真实角色）；
  /// 若无正文前缀则回退至显式 speaker 字段；若皆无则返回 null 交由主角色兜底
  String? get effectiveSpeaker {
    final m = RegExp(r'^\s*(?:\*\*)?[【\[]\s*([^】\]\n]{1,16}?)\s*[】\]]\s*[*]{0,2}\s*[:：]?').firstMatch(text.trim());
    if (m != null) {
      final name = m.group(1)!.trim();
      // 排除环境与旁白类通用标记，真正的人名直接作为说话人
      const generics = ['天道', '系统', '环境', '旁白', '场景', '提示'];
      if (name.isNotEmpty && !generics.any((g) => name.startsWith(g))) {
        return name;
      }
    }
    if (speaker != null && speaker!.trim().isNotEmpty) {
      final s = speaker!.trim();
      if (RegExp(r'^(an|usr_.*|ancient.*|system|ai|unknown)$', caseSensitive: false).hasMatch(s)) {
        if (text.contains('酒肆') || text.contains('续酒') || text.contains('紫嫣')) {
          return '酒肆伙计';
        }
        return '伴侣';
      }
      return s;
    }
    // 正文内容兜底推导说话人（防止历史无【】标签的主动消息丢失身份）
    if (text.contains('续酒') || text.contains('旧账纸') || (text.contains('酒肆') && text.contains('紫嫣'))) {
      return '酒肆伙计';
    }
    return null;
  }

  /// 提取过滤掉 [emoji:xxx]、[compare:xxx]、[image:xxx]、[music:xxx] 后的干净文字
  String get displayCleanText {
    var clean = text;
    clean = clean.replaceAll(RegExp(r'\[emoji:[a-zA-Z0-9_-]+\]?'), '');
    clean = clean.replaceAll(RegExp(r'\[compare:[^\]\n]+\]?'), '');
    clean = clean.replaceAll(RegExp(r'\[image:[^\]\n]+\]?'), '');
    clean = clean.replaceAll(RegExp(r'\[music:[^\]\n]+\]?'), '').trim();
    // 若正文开头遗留了【xxx】：或【xxx】，在显示时自动剥离前缀，避免与气泡姓名标签重复
    final spk = effectiveSpeaker;
    if (spk != null && spk.isNotEmpty) {
      clean = clean.replaceFirst(RegExp('^\\s*【\\s*${RegExp.escape(spk)}\\s*】\\s*[:：]?\\s*'), '').trim();
    }
    if (clean.isEmpty) {
      if (detectedEmoji != null) return '（发来了一个表情包）';
      if (detectedImageUrl != null) return '（奉上一张自拍画像）';
      if (detectedMusicTitle != null) return '（为你抚琴浅唱）';
    }
    return clean;
  }

  /// 提取识别到的表情包代号
  String? get detectedEmoji {
    if (emojiType != null && emojiType!.isNotEmpty) return emojiType;
    final match = RegExp(r'\[emoji:([a-zA-Z0-9_-]+)\]?').firstMatch(text);
    return match?.group(1)?.toLowerCase();
  }

  /// 提取比价关键词（格式形如 [compare:海信电视遥控器]）
  String? get detectedCompareKeyword {
    final match = RegExp(r'\[compare:([^\]\n]+)\]?').firstMatch(text);
    return match?.group(1)?.trim();
  }

  /// 提取图片直链（格式形如 [image:https://...]）
  String? get detectedImageUrl {
    final match = RegExp(r'\[image:(https?://[^\s\]\n]+)\]?').firstMatch(text);
    var url = match?.group(1)?.trim();
    if (url != null) {
      // 去除末尾截断可能留下的省略号或多余的 % 字符
      url = url.replaceAll(RegExp(r'[%…\.]+$'), '');
    }
    return url;
  }

  /// 提取音乐歌曲名（格式形如 [music:相思引] 或 [music:相思引|https://...]）
  String? get detectedMusicTitle {
    final match = RegExp(r'\[music:([^\|\s\]\n]+)(?:\|[^\s\]\n]+)?\]?').firstMatch(text);
    return match?.group(1)?.trim();
  }

  /// 提取音乐播放音频直链（格式形如 [music:歌名|https://...]）
  String? get detectedMusicUrl {
    final match = RegExp(r'\[music:[^\|\s\]\n]+\|([^\s\]\n]+)\]?').firstMatch(text);
    var url = match?.group(1)?.trim();
    if (url != null) {
      url = url.replaceAll(RegExp(r'[%…\.]+$'), '');
    }
    return url;
  }

  /// 智能推导说话人常驻/所在地点（用于非同场时提供"动身前往"快捷操作）
  String? get inferredPlace {
    if (place != null && place!.isNotEmpty) return place;
    final spk = effectiveSpeaker ?? '';
    if (spk.contains('紫嫣') || spk.contains('酒肆') || text.contains('酒肆') || text.contains('续酒')) return '于家酒肆';
    if (spk.contains('静儿') || spk.contains('县衙') || text.contains('县衙')) return '县衙';
    if (spk.contains('采云') || spk.contains('货栈') || text.contains('货栈')) return '翟家货栈';
    if (spk.contains('孙进') || spk.contains('客栈') || text.contains('客栈')) return '临江客栈';
    if (spk.contains('鲁青') || spk.contains('窑厂') || text.contains('窑厂')) return '城南窑厂';
    if (spk.contains('芸娘') || spk.contains('茶坊') || text.contains('茶坊')) return '临江茶坊';
    return null;
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'text': text,
        'isUser': isUser,
        'timestamp': timestamp.toIso8601String(),
        'modality': modality,
        'audioUrl': audioUrl,
        'emojiType': emojiType ?? detectedEmoji,
        'isError': isError,
        'speaker': speaker,
        'place': place,
        'isLetter': isLetter,
      };

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String? ?? DateTime.now().millisecondsSinceEpoch.toString(),
        text: json['text'] as String? ?? '',
        isUser: json['isUser'] as bool? ?? false,
        timestamp: json['timestamp'] != null
            ? DateTime.parse(json['timestamp'] as String)
            : DateTime.now(),
        modality: json['modality'] as String? ?? 'text',
        audioUrl: json['audioUrl'] as String?,
        emojiType: json['emojiType'] as String?,
        isError: json['isError'] as bool? ?? false,
        speaker: json['speaker'] as String?,
        place: json['place'] as String?,
        isLetter: json['isLetter'] as bool? ?? false,
      );

  ChatMessage copyWith({
    String? id,
    String? text,
    bool? isUser,
    DateTime? timestamp,
    String? modality,
    String? audioUrl,
    String? emojiType,
    bool? isError,
    bool? isPending,
    List<String>? notices,
    String? speaker,
    String? place,
    bool? isLetter,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      text: text ?? this.text,
      isUser: isUser ?? this.isUser,
      timestamp: timestamp ?? this.timestamp,
      modality: modality ?? this.modality,
      audioUrl: audioUrl ?? this.audioUrl,
      emojiType: emojiType ?? this.emojiType,
      isError: isError ?? this.isError,
      isPending: isPending ?? this.isPending,
      notices: notices ?? this.notices,
      speaker: speaker ?? this.speaker,
      place: place ?? this.place,
      isLetter: isLetter ?? this.isLetter,
    );
  }
}
