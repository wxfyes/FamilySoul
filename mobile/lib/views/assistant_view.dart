import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:image_picker/image_picker.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:flutter/services.dart';
import '../services/api_client.dart';

class AssistantMessage {
  final String role;
  final String text;
  final DateTime at;

  AssistantMessage({required this.role, required this.text, required this.at});
}

class AssistantView extends StatefulWidget {
  final SurfCoreApiClient apiClient;

  const AssistantView({super.key, required this.apiClient});

  @override
  State<AssistantView> createState() => _AssistantViewState();
}

class _AssistantViewState extends State<AssistantView> {
  final List<AssistantMessage> _messages = [];
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final raw = await widget.apiClient.getAssistantHistory();
    if (!mounted) return;
    setState(() {
      _messages.clear();
      for (final item in raw) {
        final role = item['role']?.toString() ?? 'user';
        final content = item['content']?.toString() ?? item['text']?.toString() ?? '';
        final atMs = item['at'] is int ? item['at'] as int : DateTime.now().millisecondsSinceEpoch;
        if (content.isNotEmpty) {
          _messages.add(AssistantMessage(
            role: role,
            text: content,
            at: DateTime.fromMillisecondsSinceEpoch(atMs),
          ));
        }
      }
    });
    _scrollToBottom();
  }

  void _scrollToBottom() {
    void go() {
      if (!mounted || !_scrollController.hasClients) return;
      _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      go();
      // 列表还没量完时再补一次，保证切回来就在最新一条
      Future<void>.delayed(const Duration(milliseconds: 220), go);
      Future<void>.delayed(const Duration(milliseconds: 520), go);
    });
  }

  bool _listening = false;
  final SpeechToText _speech = SpeechToText();
  String? _imageBase64;
  String? _imageMime;

  Future<void> _toggleMic() async {
    try {
      if (_listening) {
        await _speech.stop();
        setState(() => _listening = false);
        return;
      }
      final ok = await _speech.initialize();
      if (!ok) return;
      setState(() => _listening = true);
      await _speech.listen(
        listenOptions: SpeechListenOptions(localeId: 'zh_CN'),
        onResult: (r) {
          if (r.recognizedWords.isNotEmpty) {
            _inputController.text = r.recognizedWords;
            _inputController.selection = TextSelection.fromPosition(TextPosition(offset: _inputController.text.length));
          }
        },
      );
    } catch (_) {
      if (mounted) setState(() => _listening = false);
    }
  }

  Future<void> _pickImage() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1280, imageQuality: 82);
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      setState(() {
        _imageBase64 = base64Encode(bytes);
        _imageMime = 'image/jpeg';
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('已选好一张图，发出去我看看'),
          duration: Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (_) {}
  }

  Future<void> _sendMessage() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _isLoading) return;

    _inputController.clear();
    setState(() {
      _messages.add(AssistantMessage(role: 'user', text: text, at: DateTime.now()));
      _isLoading = true;
    });
    _scrollToBottom();

    final reply = await widget.apiClient.askAssistant(text, imageBase64: _imageBase64, mimeType: _imageMime);
    if (!mounted) return;

    setState(() {
      _isLoading = false;
      _messages.add(AssistantMessage(
        role: 'assistant',
        text: reply ?? '网络开小差了，请稍后再试～',
        at: DateTime.now(),
      ));
    });
    _scrollToBottom();
  }

  Future<void> _clearHistory() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('清空助手记录'),
        content: const Text('确定要清空当前的 AI 助手对话历史吗？此操作不影响虚拟世界。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('清空', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await widget.apiClient.clearAssistantHistory();
      if (!mounted) return;
      setState(() {
        _messages.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('已清空助手对话记录'), duration: Duration(seconds: 1)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Column(
      children: [
        // 顶部小横条提示：现代智能助手定位
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
          child: Row(
            children: [
              const Icon(Icons.auto_awesome, color: Color(0xFF3B82F6), size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  '天机助手 · 查资料、写文案、解答百科（独立对话）',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded, size: 20, color: Colors.grey),
                tooltip: '清空历史',
                onPressed: _messages.isEmpty ? null : _clearHistory,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
        ),

        // 问答消息流
        Expanded(
          child: _messages.isEmpty && !_isLoading
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.psychology_alt_outlined, size: 56, color: Colors.grey.withValues(alpha: 0.4)),
                      const SizedBox(height: 12),
                      const Text(
                        '有什么想问的？随时告诉我',
                        style: TextStyle(fontSize: 15, color: Colors.grey, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '支持日常百科、查阅诗词公文、技术代码排查等',
                        style: TextStyle(fontSize: 12, color: Colors.grey.withValues(alpha: 0.8)),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  itemCount: _messages.length + (_isLoading ? 1 : 0),
                  itemBuilder: (ctx, i) {
                    if (i == _messages.length && _isLoading) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF1E293B) : Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: Colors.grey.withValues(alpha: 0.15)),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF3B82F6)),
                                  ),
                                  SizedBox(width: 8),
                                  Text('天机思索中…', style: TextStyle(fontSize: 13, color: Colors.grey)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }

                    final msg = _messages[i];
                    final isUser = msg.role == 'user';
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (!isUser) ...[
                            CircleAvatar(
                              radius: 16,
                              backgroundColor: const Color(0xFF3B82F6),
                              child: const Icon(Icons.bolt_rounded, size: 18, color: Colors.white),
                            ),
                            const SizedBox(width: 8),
                          ],
                          Flexible(
                            child: GestureDetector(
                              onLongPress: () {
                                Clipboard.setData(ClipboardData(text: msg.text));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('已复制内容'), duration: Duration(milliseconds: 800)),
                                );
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                                decoration: BoxDecoration(
                                  color: isUser
                                      ? const Color(0xFF3B82F6)
                                      : (isDark ? const Color(0xFF1E293B) : Colors.white),
                                  borderRadius: BorderRadius.circular(16).copyWith(
                                    bottomRight: isUser ? const Radius.circular(2) : null,
                                    bottomLeft: !isUser ? const Radius.circular(2) : null,
                                  ),
                                  border: isUser
                                      ? null
                                      : Border.all(color: Colors.grey.withValues(alpha: 0.15)),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.03),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: SelectableText(
                                  msg.text,
                                  style: TextStyle(
                                    fontSize: 14.5,
                                    height: 1.45,
                                    color: isUser
                                        ? Colors.white
                                        : (isDark ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B)),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          if (isUser) ...[
                            const SizedBox(width: 8),
                            CircleAvatar(
                              radius: 16,
                              backgroundColor: const Color(0xFF8B5CF6),
                              child: const Icon(Icons.person, size: 18, color: Colors.white),
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                ),
        ),

        // 底部问答输入框
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E293B) : Colors.white,
            border: Border(top: BorderSide(color: Colors.grey.withValues(alpha: 0.15))),
          ),
          child: SafeArea(
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _inputController,
                    maxLines: 4,
                    minLines: 1,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendMessage(),
                    decoration: InputDecoration(
                      hintText: '向天机助手提问任何事…',
                      hintStyle: const TextStyle(fontSize: 14, color: Colors.grey),
                      filled: true,
                      fillColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(20),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                IconButton(
                  tooltip: '按住说话',
                  icon: Icon(_listening ? Icons.mic_rounded : Icons.mic_none_rounded,
                      color: _listening ? const Color(0xFFEF4444) : Colors.grey),
                  onPressed: _toggleMic,
                ),
                IconButton(
                  tooltip: '发一张图给助手看',
                  icon: const Icon(Icons.add_photo_alternate_outlined, color: Colors.grey),
                  onPressed: _pickImage,
                ),
                IconButton(
                  icon: const Icon(Icons.send_rounded, color: Color(0xFF3B82F6)),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

