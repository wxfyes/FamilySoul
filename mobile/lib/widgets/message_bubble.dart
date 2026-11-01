import 'dart:io';
import 'package:flutter/material.dart';
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

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    final timeStr = DateFormat('HH:mm').format(message.timestamp);
    // 谁说这句话就显示谁的名字：分角剧本里的角色优先，否则用当前主角色
    final speakerName = (message.speaker != null && message.speaker!.isNotEmpty)
        ? message.speaker!
        : characterName;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 6.0),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isUser) ...[
            _buildAvatar(isUser: false, name: speakerName),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!isUser && speakerName.isNotEmpty && !message.isPending)
                  Padding(
                    padding: const EdgeInsets.only(left: 4.0, bottom: 4.0),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: _colorForName(speakerName),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          speakerName,
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                  decoration: BoxDecoration(
                    color: isUser
                        ? const Color(0xFF2563EB) // 精致科技蓝
                        : (message.isError
                            ? const Color(0xFFFEE2E2)
                            : Theme.of(context).cardColor),
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(18),
                      topRight: const Radius.circular(18),
                      bottomLeft: Radius.circular(isUser ? 18 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 18),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
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
                              SelectableText(
                                message.displayCleanText,
                                style: TextStyle(
                                  fontSize: 15.5,
                                  height: 1.45,
                                  color: isUser
                                      ? Colors.white
                                      : (message.isError
                                          ? const Color(0xFFDC2626)
                                          : Theme.of(context).textTheme.bodyLarge?.color),
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
                          ],
                        ),
                ),
                const SizedBox(height: 4),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4.0),
                  child: Text(
                    timeStr,
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (isUser) ...[
            const SizedBox(width: 8),
            _buildAvatar(isUser: true, name: '我'),
          ],
        ],
      ),
    );
  }

  static const List<Color> _assistantPalette = [
    Color(0xFF8B5CF6),
    Color(0xFFEC4899),
    Color(0xFF0EA5E9),
    Color(0xFFF59E0B),
    Color(0xFF10B981),
    Color(0xFF6366F1),
  ];

  /// 同一个名字永远得到同一种颜色（不随运行变化）
  Color _colorForName(String name) {
    if (name.isEmpty) return _assistantPalette.first;
    var h = 0;
    for (final c in name.codeUnits) {
      h = (h * 31 + c) & 0x7fffffff;
    }
    return _assistantPalette[h % _assistantPalette.length];
  }

  /// 「跑堂伙计·阿吉」取「阿」，「沈婉儿」取「沈」
  String _initialOf(String name) {
    final parts = name.split(RegExp(r'[·•.]'));
    final last = parts.last.trim();
    if (last.isNotEmpty) return last.characters.first;
    return name.isNotEmpty ? name.characters.first : 'A';
  }

  Widget _buildAvatar({required bool isUser, required String name}) {
    final base = isUser ? const Color(0xFF3B82F6) : _colorForName(name);
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: isUser
              ? [const Color(0xFF3B82F6), const Color(0xFF1D4ED8)]
              : [base, Color.lerp(base, Colors.black, 0.28)!],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: base.withValues(alpha: 0.25),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Center(
        child: Text(
          isUser ? '我' : _initialOf(name),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
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
                isPlaying ? '正在播放${characterName.isNotEmpty ? characterName : "伴侣"}语音...' : '点击播放${characterName.isNotEmpty ? characterName : "伴侣"}语音',
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
}
