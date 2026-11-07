import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/chat_message.dart';
import '../providers/chat_provider.dart';
import 'emoji_sticker.dart';
import 'compare_card.dart';

class MessageBubble extends StatelessWidget {
  final ChatMessage message;
  final String characterName;

  const MessageBubble({
    super.key,
    required this.message,
    this.characterName = 'AI',
  });

  /// 谁说这句话就显示谁的名字：分角剧本角色优先，其次从正文推导发言人，否则用当前主角色
  String get displaySpeakerName {
    final resolved = message.speaker ?? message.effectiveSpeaker;
    return (resolved != null && resolved.isNotEmpty) ? resolved : characterName;
  }

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    final timeStr = DateFormat('HH:mm').format(message.timestamp);
    final speakerName = displaySpeakerName;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final chatProvider = context.watch<ChatProvider>();
    final currentPlace = chatProvider.currentPlace;
    final hereNames = chatProvider.hereNames;

    // 严谨判定是否面对面同场（在场名单有此人，或推导地点与相公当前地点一致）：
    final isPresentHere = hereNames.isNotEmpty &&
        hereNames.any((h) => h.isNotEmpty && (speakerName.contains(h) || h.contains(speakerName)));
    final isSamePlace = currentPlace.isNotEmpty &&
        message.inferredPlace != null &&
        (currentPlace.contains(message.inferredPlace!) || message.inferredPlace!.contains(currentPlace));

    // 只有在非同场（确实不在身边，隔空递信）且有目标地点时，才展示递信标牌与动身按钮
    final shouldShowLetterBadge = !isUser &&
        !message.isPending &&
        !isPresentHere &&
        !isSamePlace &&
        (message.isLetter || message.inferredPlace != null);

    final shouldShowGoButton = !isUser &&
        !message.isPending &&
        !isPresentHere &&
        !isSamePlace &&
        message.inferredPlace != null &&
        message.inferredPlace!.isNotEmpty;

    // 系统提示气泡（无头像、无角色称谓、居中小灰条）
    final cleanTrim = message.text.trim();
    final isNotice = !isUser && (
      speakerName == '提示' ||
      speakerName.contains('提示') ||
      cleanTrim.startsWith('【提示】') ||
      cleanTrim.startsWith('[提示]')
    );

    if (isNotice) {
      var noticeContent = message.displayCleanText;
      if (noticeContent.startsWith('【提示】') || noticeContent.startsWith('[提示]')) {
        noticeContent = noticeContent.substring(4).trim();
        if (noticeContent.startsWith(':') || noticeContent.startsWith('：')) {
          noticeContent = noticeContent.substring(1).trim();
        }
      }
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 5.0),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E222D).withValues(alpha: 0.8) : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isDark ? Colors.white12 : Colors.black.withValues(alpha: 0.06)),
            ),
            child: Text(
              noticeContent,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white60 : const Color(0xFF475569),
                height: 1.35,
              ),
            ),
          ),
        ),
      );
    }

    final meta = _SpeakerMeta.resolve(speakerName, isUser: isUser);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 7.0),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isUser) ...[
            _buildAvatar(context, isUser: false, meta: meta),
            const SizedBox(width: 10),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                // 伴侣 / NPC 身份称谓胶囊药丸（雅致国风标）
                if (!isUser && !message.isPending)
                  Padding(
                    padding: const EdgeInsets.only(left: 2.0, bottom: 5.0),
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                          decoration: BoxDecoration(
                            color: meta.primaryColor.withValues(alpha: isDark ? 0.22 : 0.10),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: meta.primaryColor.withValues(alpha: isDark ? 0.35 : 0.22),
                              width: 0.8,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(meta.symbol, style: const TextStyle(fontSize: 10.5)),
                              const SizedBox(width: 4),
                              Text(
                                meta.title.isEmpty ? meta.name : '${meta.title} · ${meta.name}',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                  color: meta.primaryColor,
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (shouldShowLetterBadge)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF2A2318) : const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: isDark ? const Color(0xFF78350F) : const Color(0xFFFDE68A),
                                width: 0.8,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text('💌', style: TextStyle(fontSize: 9.5)),
                                const SizedBox(width: 3),
                                Text(
                                  message.inferredPlace != null
                                      ? '${message.inferredPlace}·递信'
                                      : '差人递信',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w500,
                                    color: isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),

                // 核心对话气泡（大圆角、现代轻呼吸投影、通透质感）
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                  decoration: BoxDecoration(
                    color: isUser
                        ? const Color(0xFF2563EB) // 高级科技雅蓝
                        : (message.isError
                            ? const Color(0xFFFEE2E2)
                            : (isDark ? const Color(0xFF1E222D) : Colors.white)),
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(18),
                      topRight: const Radius.circular(18),
                      bottomLeft: Radius.circular(isUser ? 18 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 18),
                    ),
                    border: isUser
                        ? null
                        : Border.all(
                            color: isDark
                                ? Colors.white.withValues(alpha: 0.08)
                                : Colors.black.withValues(alpha: 0.05),
                            width: 0.8,
                          ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: message.isPending
                      ? _buildThinkingIndicator()
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (message.displayCleanText.isNotEmpty &&
                                message.displayCleanText != '（发来了一个表情包）')
                              ..._buildFormattedText(
                                context,
                                message.displayCleanText,
                                isUser: isUser,
                                isError: message.isError,
                                meta: meta,
                                isDark: isDark,
                              ),
                            if (message.isError)
                              Padding(
                                padding: const EdgeInsets.only(top: 6.0),
                                child: TextButton.icon(
                                  onPressed: () => context.read<ChatProvider>().retryLastMessage(),
                                  icon: const Icon(Icons.refresh, size: 16),
                                  label: const Text('重试'),
                                  style: TextButton.styleFrom(
                                    foregroundColor: const Color(0xFFDC2626),
                                    padding: const EdgeInsets.symmetric(horizontal: 4),
                                    minimumSize: const Size(56, 28),
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  ),
                                ),
                              ),
                            if (message.localImagePath != null && File(message.localImagePath!).existsSync())
                              _buildLocalImageCard(context, message.localImagePath!),
                            if (message.audioUrl != null && message.audioUrl!.isNotEmpty)
                              _buildVoiceBar(context, message.audioUrl!),
                            if (message.detectedEmoji != null)
                              EmojiSticker(emojiCode: message.detectedEmoji!),
                            if (message.detectedCompareKeyword != null)
                              CompareCard(keyword: message.detectedCompareKeyword!),
                            if (message.detectedImageUrl != null)
                              _buildImageCard(context, message.detectedImageUrl!),
                            if (message.detectedMusicTitle != null)
                              _buildMusicCard(context, message.detectedMusicTitle!, message.detectedMusicUrl),
                            if (shouldShowGoButton)
                              _buildGoToTargetButton(
                                context,
                                message.inferredPlace!,
                                meta.name.isNotEmpty ? meta.name : characterName,
                                isDark,
                              ),
                          ],
                        ),
                ),
                const SizedBox(height: 3),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4.0),
                  child: Text(
                    timeStr,
                    style: TextStyle(
                      fontSize: 10.5,
                      color: isDark ? Colors.white30 : Colors.grey.shade400,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (isUser) ...[
            const SizedBox(width: 10),
            _buildAvatar(context, isUser: true, meta: meta),
          ],
        ],
      ),
    );
  }

  /// 呼吸感图文排版：神态动作与台词分离，告别长篇大论挤压
  List<Widget> _buildFormattedText(
    BuildContext context,
    String raw, {
    required bool isUser,
    required bool isError,
    required _SpeakerMeta meta,
    required bool isDark,
  }) {
    // 过滤多余的首尾引号或分角括号前缀
    var cleaned = raw.trim();
    if (cleaned.startsWith('：“') && cleaned.endsWith('”')) {
      cleaned = cleaned.substring(2, cleaned.length - 1);
    } else if (cleaned.startsWith(':"') && cleaned.endsWith('"')) {
      cleaned = cleaned.substring(2, cleaned.length - 1);
    }

    final segments = _parseSegments(cleaned);
    final widgets = <Widget>[];

    for (var i = 0; i < segments.length; i++) {
      final seg = segments[i];
      if (seg.isAction) {
        // 动作/神态描写：柔和斜体小字 + 雅致左侧微竖线
        widgets.add(
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3.0),
            child: Container(
              padding: const EdgeInsets.only(left: 7.0, top: 1.0, bottom: 1.0),
              decoration: BoxDecoration(
                border: Border(
                  left: BorderSide(
                    color: isUser
                        ? Colors.white38
                        : meta.primaryColor.withValues(alpha: isDark ? 0.45 : 0.35),
                    width: 2.0,
                  ),
                ),
              ),
              child: Text(
                seg.text,
                style: TextStyle(
                  fontSize: 13.5,
                  height: 1.4,
                  fontStyle: FontStyle.italic,
                  color: isUser
                      ? Colors.white70
                      : (isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                ),
              ),
            ),
          ),
        );
      } else {
        // 说话对白：清晰字阶，行高自然饱满
        widgets.add(
          Padding(
            padding: EdgeInsets.only(top: i > 0 ? 3.0 : 0.0, bottom: i < segments.length - 1 ? 3.0 : 0.0),
            child: SelectableText(
              seg.text,
              style: TextStyle(
                fontSize: 15.5,
                height: 1.48,
                letterSpacing: 0.2,
                color: isUser
                    ? Colors.white
                    : (isError
                        ? const Color(0xFFDC2626)
                        : (isDark ? const Color(0xFFF1F5F9) : const Color(0xFF1E293B))),
              ),
            ),
          ),
        );
      }
    }
    return widgets;
  }

  /// 智能拆解神态动作括号 （...） 与常规台词
  List<_TextSegment> _parseSegments(String text) {
    final list = <_TextSegment>[];
    final reg = RegExp(r'（[^）]+）|\([^\)]+\)');
    var last = 0;
    for (final m in reg.allMatches(text)) {
      if (m.start > last) {
        final t = text.substring(last, m.start).trim();
        if (t.isNotEmpty) list.add(_TextSegment(text: t, isAction: false));
      }
      final act = m.group(0)!.trim();
      if (act.isNotEmpty) list.add(_TextSegment(text: act, isAction: true));
      last = m.end;
    }
    if (last < text.length) {
      final t = text.substring(last).trim();
      if (t.isNotEmpty) list.add(_TextSegment(text: t, isAction: false));
    }
    return list.isEmpty ? [_TextSegment(text: text, isAction: false)] : list;
  }

  /// 雅致国风水墨印章头像
  Widget _buildAvatar(BuildContext context, {required bool isUser, required _SpeakerMeta meta}) {
    final provider = context.watch<ChatProvider>();
    final remoteUrl = provider.avatarUrlFor(meta.raw);

    // 古典印章回退微标
    final fallback = Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [meta.primaryColor, meta.secondaryColor],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              meta.symbol,
              style: const TextStyle(fontSize: 10, height: 1.1),
            ),
            Text(
              meta.name.isNotEmpty ? meta.name.characters.first : (isUser ? '我' : '伴'),
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 14,
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );

    final avatar = Container(
      width: 42,
      height: 42,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: meta.primaryColor.withValues(alpha: 0.35),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: meta.primaryColor.withValues(alpha: 0.22),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: remoteUrl == null || remoteUrl.isEmpty
          ? fallback
          : Image.network(
              remoteUrl,
              fit: BoxFit.cover,
              width: 42,
              height: 42,
              errorBuilder: (_, __, ___) => fallback,
              loadingBuilder: (c, child, progress) => progress == null ? child : fallback,
            ),
    );

    // 长按头像 → 从相册更换
    return GestureDetector(
      onLongPress: () => _pickAvatar(context, meta.raw),
      child: avatar,
    );
  }

  Future<void> _pickAvatar(BuildContext context, String speaker) async {
    final provider = context.read<ChatProvider>();
    await showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text('给「$speaker」换头像'),
              subtitle: const Text('从相册选一张，全家共享'),
              onTap: () async {
                Navigator.pop(sheetContext);
                final picked = await ImagePicker().pickImage(
                  source: ImageSource.gallery,
                  maxWidth: 512,
                  maxHeight: 512,
                  imageQuality: 85,
                );
                if (picked == null) return;
                final ok = await provider.setAvatarFromFile(speaker, picked.path);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(ok ? '「$speaker」头像已更新' : '上传失败，检查网络或服务端版本')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.close),
              title: const Text('取消'),
              onTap: () => Navigator.pop(sheetContext),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildThinkingIndicator() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(Colors.grey.shade600),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          '正在思考回复...',
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey.shade600,
            fontStyle: FontStyle.italic,
          ),
        ),
      ],
    );
  }

  Widget _buildVoiceBar(BuildContext context, String audioUrl) {
    final provider = context.watch<ChatProvider>();
    final isPlaying = provider.currentPlayingUrl == audioUrl && provider.isPlayingAudio;

    return Padding(
      padding: const EdgeInsets.only(top: 8.0),
      child: InkWell(
        onTap: () {
          provider.playAudio(audioUrl);
        },
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isPlaying
                ? const Color(0xFF8B5CF6).withValues(alpha: 0.15)
                : Colors.grey.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isPlaying ? const Color(0xFF8B5CF6) : Colors.transparent,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isPlaying ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded,
                size: 20,
                color: const Color(0xFF8B5CF6),
              ),
              const SizedBox(width: 6),
              Icon(
                isPlaying ? Icons.graphic_eq_rounded : Icons.volume_up_rounded,
                size: 16,
                color: isPlaying ? const Color(0xFF8B5CF6) : Colors.grey.shade600,
              ),
              const SizedBox(width: 6),
              Text(
                isPlaying
                    ? '正在播放${displaySpeakerName.isNotEmpty ? displaySpeakerName : '伴侣'}语音...'
                    : '点击播放${displaySpeakerName.isNotEmpty ? displaySpeakerName : '伴侣'}语音',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isPlaying ? FontWeight.bold : FontWeight.normal,
                  color: isPlaying ? const Color(0xFF8B5CF6) : Colors.grey.shade700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImageCard(BuildContext context, String imageUrl) {
    return Padding(
      padding: const EdgeInsets.only(top: 8.0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: GestureDetector(
          onTap: () {
            showDialog(
              context: context,
              builder: (ctx) => Dialog(
                backgroundColor: Colors.transparent,
                insetPadding: const EdgeInsets.all(12),
                child: Stack(
                  alignment: Alignment.topRight,
                  children: [
                    InteractiveViewer(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.network(imageUrl, fit: BoxFit.contain),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),
            );
          },
          child: Container(
            constraints: const BoxConstraints(maxWidth: 240, maxHeight: 320),
            child: Image.network(
              imageUrl,
              fit: BoxFit.cover,
              loadingBuilder: (ctx, child, progress) {
                if (progress == null) return child;
                return Container(
                  height: 180,
                  width: 220,
                  color: Colors.grey.withValues(alpha: 0.1),
                  child: const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF8B5CF6)),
                        ),
                        SizedBox(height: 8),
                        Text('小娘子对镜理红妆画影中...', style: TextStyle(fontSize: 11, color: Colors.grey)),
                      ],
                    ),
                  ),
                );
              },
              errorBuilder: (ctx, err, stack) => Container(
                padding: const EdgeInsets.all(12),
                color: Colors.grey.withValues(alpha: 0.1),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.broken_image_rounded, size: 20, color: Colors.grey),
                    SizedBox(width: 6),
                    Text('画像加载失败', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLocalImageCard(BuildContext context, String localPath) {
    return Padding(
      padding: const EdgeInsets.only(top: 8.0, bottom: 4.0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: GestureDetector(
          onTap: () {
            showDialog(
              context: context,
              builder: (ctx) => Dialog(
                backgroundColor: Colors.transparent,
                insetPadding: const EdgeInsets.all(12),
                child: Stack(
                  alignment: Alignment.topRight,
                  children: [
                    InteractiveViewer(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.file(File(localPath), fit: BoxFit.contain),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),
            );
          },
          child: Container(
            constraints: const BoxConstraints(maxWidth: 240, maxHeight: 320),
            child: Image.file(
              File(localPath),
              fit: BoxFit.cover,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMusicCard(BuildContext context, String songTitle, String? musicUrl) {
    final provider = Provider.of<ChatProvider>(context);
    final isPlayingThis = musicUrl != null &&
        provider.isPlayingAudio &&
        provider.currentPlayingUrl == musicUrl;

    return Padding(
      padding: const EdgeInsets.only(top: 8.0),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (musicUrl != null && musicUrl.isNotEmpty) {
              provider.playAudio(musicUrl);
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('暂未解析到该曲目音频直链')),
              );
            }
          },
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: isPlayingThis
                  ? const Color(0xFF8B5CF6).withValues(alpha: 0.16)
                  : const Color(0xFF8B5CF6).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isPlayingThis ? const Color(0xFF8B5CF6) : const Color(0xFF8B5CF6).withValues(alpha: 0.3),
                width: isPlayingThis ? 1.5 : 1.0,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: isPlayingThis
                          ? [const Color(0xFFEC4899), const Color(0xFF8B5CF6)]
                          : [const Color(0xFF8B5CF6), const Color(0xFFEC4899)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    boxShadow: isPlayingThis
                        ? [
                            BoxShadow(
                              color: const Color(0xFF8B5CF6).withValues(alpha: 0.4),
                              blurRadius: 8,
                              spreadRadius: 1,
                            ),
                          ]
                        : null,
                  ),
                  child: Icon(
                    isPlayingThis ? Icons.graphic_eq_rounded : Icons.music_note_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      songTitle.startsWith('《') ? songTitle : '《$songTitle》',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF6D28D9),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isPlayingThis ? '小娘子抚琴伴唱中 · 点击暂停' : '小娘子抚琴浅唱 · 点击即听',
                      style: TextStyle(
                        fontSize: 10.5,
                        color: isPlayingThis ? const Color(0xFF8B5CF6) : Colors.grey.shade600,
                        fontWeight: isPlayingThis ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                Icon(
                  isPlayingThis ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded,
                  color: const Color(0xFF8B5CF6),
                  size: 26,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// 消除隔空喊话假象：提供一键物理移步前往当面相叙的快捷国风药丸
  Widget _buildGoToTargetButton(
    BuildContext context,
    String targetPlace,
    String targetName,
    bool isDark,
  ) {
    final isMale = targetName.contains('孙进') ||
        targetName.contains('鲁青') ||
        targetName.contains('何顺') ||
        targetName.contains('杨振华') ||
        targetName.contains('掌柜') ||
        targetName.contains('工头') ||
        targetName.contains('捕快') ||
        targetName.contains('知府') ||
        targetName.contains('老汉');
    final actionLabel = (targetName.contains('伙计') || targetName.contains('小厮') || targetName.contains('小二'))
        ? '动身前往「$targetPlace」'
        : '动身前往「$targetPlace」${isMale ? '找他' : '找她'}';

    return Padding(
      padding: const EdgeInsets.only(top: 8.0),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () async {
            HapticFeedback.mediumImpact();
            final chatProvider = context.read<ChatProvider>();
            final messenger = ScaffoldMessenger.of(context);
            final line = await chatProvider.travelTo(targetPlace, targetName: targetName);
            if (line != null && line.isNotEmpty) {
              messenger.showSnackBar(
                SnackBar(
                  content: Text(line),
                  duration: const Duration(seconds: 4),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF262035) : const Color(0xFFF5F3FF),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isDark ? const Color(0xFF6D28D9).withValues(alpha: 0.5) : const Color(0xFFDDD6FE),
                width: 0.8,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.directions_walk_rounded, size: 14, color: Color(0xFF8B5CF6)),
                const SizedBox(width: 4),
                Text(
                  actionLabel,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF7C3AED),
                  ),
                ),
                const SizedBox(width: 2),
                const Icon(Icons.keyboard_arrow_right_rounded, size: 14, color: Color(0xFF8B5CF6)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 文本分段：普通台词 vs 动作神态描写
class _TextSegment {
  final String text;
  final bool isAction;

  const _TextSegment({required this.text, required this.isAction});
}

/// 发言角色身份与雅致国风美学元数据
class _SpeakerMeta {
  final String raw;
  final String title;
  final String name;
  final String symbol;
  final Color primaryColor;
  final Color secondaryColor;

  const _SpeakerMeta({
    required this.raw,
    required this.title,
    required this.name,
    required this.symbol,
    required this.primaryColor,
    required this.secondaryColor,
  });

  static _SpeakerMeta resolve(String rawSpeaker, {required bool isUser}) {
    if (isUser) {
      return const _SpeakerMeta(
        raw: '我',
        title: '相公',
        name: '我',
        symbol: '👑',
        primaryColor: Color(0xFF2563EB),
        secondaryColor: Color(0xFF1D4ED8),
      );
    }

    var s = rawSpeaker.trim();

    // 彻底清洗英文代码代号、孤立拼音与非人类字符
    if (RegExp(r'^(an|usr_.*|ancient.*|system|ai|unknown)$', caseSensitive: false).hasMatch(s)) {
      s = '酒肆伙计';
    }

    // 1. 沈婉儿（正妻 · 牡丹朱砂）
    // 6.5 服务端给了身份前缀（如「帮工·鲁青」）：按身份做标题，不再一律叫"客卿"
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

    // 6.8 旁白 / 天道：是叙述，不是人
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

    // 7. 通用市井伴侣 / NPC 角色（名字哈希古典色调）
    final clean = s.replaceAll(RegExp(r'[【】·•.\[\]:："”]'), '').trim();
    final name = clean.isEmpty ? '伴侣' : (clean.length <= 4 ? clean : clean.substring(clean.length - 2));

    const palette = [
      Color(0xFF8B5CF6),
      Color(0xFFEC4899),
      Color(0xFF0EA5E9),
      Color(0xFFF59E0B),
      Color(0xFF10B981),
      Color(0xFF6366F1),
    ];
    var h = 0;
    for (final c in s.codeUnits) {
      h = (h * 31 + c) & 0x7fffffff;
    }
    final pc = palette[h % palette.length];

    return _SpeakerMeta(
      raw: s,
      title: '', // 彻底去除硬编码"客卿"，无身份前缀时干净展示真实名字，由服务端全权下发真实身份
      name: name,
      symbol: '🍵',
      primaryColor: pc,
      secondaryColor: Color.lerp(pc, Colors.black, 0.28)!,
    );
  }
}
