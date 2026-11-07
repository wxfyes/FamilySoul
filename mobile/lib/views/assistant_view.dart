import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:image_picker/image_picker.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/api_client.dart';
import '../services/offline_asr_service.dart';

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
      _scrollController.jumpTo(0);
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      go();
      // 列表还没量完时再补一次，保证切回来就在最新一条
      Future<void>.delayed(const Duration(milliseconds: 220), go);
      Future<void>.delayed(const Duration(milliseconds: 520), go);
    });
  }

  bool _isVoiceMode = false;
  bool _isHoldingRecord = false;
  bool _isCanceling = false;
  bool _isSettling = false;
  String _liveWords = '';
  DateTime? _voiceStartTime;
  bool _speechAvailable = false;
  final stt.SpeechToText _speech = stt.SpeechToText();
  String? _imageBase64;
  String? _imageMime;

  @override
  void initState() {
    super.initState();
    _loadHistory();
    if (Platform.isAndroid) {
      OfflineAsrService.instance.ensureInitialized();
    } else {
      _initSpeech();
    }
  }

  Future<void> _initSpeech() async {
    try {
      final available = await _speech.initialize(
        onError: (val) => debugPrint('[AssistantSTT] Error: ${val.errorMsg}'),
        onStatus: (val) => debugPrint('[AssistantSTT] Status: $val'),
      );
      if (mounted) {
        setState(() {
          _speechAvailable = available;
        });
      }
    } catch (e) {
      debugPrint('[AssistantSTT] 初始化异常: $e');
      _speechAvailable = false;
    }
  }

  void _onVoiceStart() async {
    if (_isHoldingRecord || _isSettling) return;

    try {
      final micStatus = await Permission.microphone.status;
      if (!micStatus.isGranted) {
        final req = await Permission.microphone.request();
        if (!req.isGranted) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Text('需要麦克风录音权限才能说话，请在设置中允许'),
                action: SnackBarAction(
                  label: '去设置',
                  onPressed: () => openAppSettings(),
                ),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
          return;
        }
      }
    } catch (_) {}

    if (!mounted) return;

    // Android: APK 内置离线模型
    if (Platform.isAndroid) {
      HapticFeedback.mediumImpact();
      setState(() {
        _isHoldingRecord = true;
        _isSettling = false;
        _isCanceling = false;
        _liveWords = '';
        _voiceStartTime = DateTime.now();
      });

      final started = await OfflineAsrService.instance.startListening(
        continuous: false,
        onResult: (text, _) {
          if (!mounted) return;
          if (_isHoldingRecord || _isSettling) {
            setState(() {
              _liveWords = text;
            });
          }
        },
      );

      if (!started && mounted) {
        setState(() => _isHoldingRecord = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('内置离线语音引擎正在初始化中，请稍候再按...'),
            duration: Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    // iOS: Apple Speech 原生
    if (!_speechAvailable) {
      await _initSpeech();
    }
    if (!_speechAvailable) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('语音服务未就绪，请在手机设置中检查是否授予麦克风与语音识别权限...'),
            duration: Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    HapticFeedback.mediumImpact();
    setState(() {
      _isHoldingRecord = true;
      _isSettling = false;
      _isCanceling = false;
      _liveWords = '';
      _voiceStartTime = DateTime.now();
    });

    try {
      await _speech.listen(
        onResult: (result) {
          if (!mounted) return;
          if (_isHoldingRecord || _isSettling) {
            setState(() {
              _liveWords = result.recognizedWords;
            });
          }
        },
        listenOptions: stt.SpeechListenOptions(
          listenMode: stt.ListenMode.confirmation,
          cancelOnError: false,
          partialResults: true,
          autoPunctuation: true,
          localeId: 'zh_CN',
        ),
      );
    } catch (e) {
      debugPrint('[AssistantSTT] 启动录音异常: $e');
      if (mounted) {
        setState(() {
          _isHoldingRecord = false;
          _isSettling = false;
        });
      }
    }
  }

  void _onVoiceMove(Offset localPosition) {
    if (!_isHoldingRecord) return;
    final shouldCancel = localPosition.dy < -50;
    if (shouldCancel != _isCanceling) {
      HapticFeedback.selectionClick();
      setState(() => _isCanceling = shouldCancel);
    }
  }

  void _onVoiceCancel() async {
    if (!_isHoldingRecord && !_isSettling) return;
    if (Platform.isAndroid) {
      try {
        await OfflineAsrService.instance.stopListening();
      } catch (_) {}
    } else {
      try {
        await _speech.stop();
      } catch (_) {}
    }
    if (mounted) {
      setState(() {
        _isHoldingRecord = false;
        _isCanceling = false;
        _isSettling = false;
      });
    }
  }

  void _onVoiceEnd() async {
    if (!_isHoldingRecord) return;

    final wasCanceling = _isCanceling;
    final duration = DateTime.now().difference(_voiceStartTime ?? DateTime.now());

    HapticFeedback.lightImpact();

    setState(() {
      _isHoldingRecord = false;
      _isCanceling = false;
      _isSettling = true;
    });

    String recognizedText = _liveWords;
    if (Platform.isAndroid) {
      try {
        final fin = await OfflineAsrService.instance.stopAndFinalize();
        if (fin.isNotEmpty) {
          recognizedText = fin;
        }
      } catch (_) {}
    } else {
      try {
        await _speech.stop();
      } catch (_) {}
      await Future.delayed(const Duration(milliseconds: 300));
      recognizedText = _liveWords;
    }

    if (!mounted) {
      _isSettling = false;
      return;
    }
    _isSettling = false;

    if (wasCanceling) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('已取消发送'),
          duration: Duration(milliseconds: 1000),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (duration.inMilliseconds < 500) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('说话时间太短'),
          duration: Duration(milliseconds: 1000),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final textToSend = recognizedText.trim();
    if (textToSend.isNotEmpty) {
      _sendDirectMessage(textToSend);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('未听清，请按住重说一次哦～'),
          duration: Duration(milliseconds: 1500),
          behavior: SnackBarBehavior.floating,
        ),
      );
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
    await _sendDirectMessage(text);
  }

  Future<void> _sendDirectMessage(String text) async {
    final clean = text.trim();
    if (clean.isEmpty || _isLoading) return;

    final imgBase64 = _imageBase64;
    final imgMime = _imageMime;
    setState(() {
      _imageBase64 = null;
      _imageMime = null;
      _messages.add(AssistantMessage(role: 'user', text: clean, at: DateTime.now()));
      _isLoading = true;
    });
    _scrollToBottom();

    final reply = await widget.apiClient.askAssistant(clean, imageBase64: imgBase64, mimeType: imgMime);
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

  /// 豆包风格高颜值录音悬浮窗
  Widget _buildVoiceHoldingModal() {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withValues(alpha: 0.35),
        child: Center(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: 220,
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
            decoration: BoxDecoration(
              color: _isCanceling ? const Color(0xFFEF4444) : Colors.white.withValues(alpha: 0.96),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 68,
                  height: 68,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isCanceling
                        ? Colors.white.withValues(alpha: 0.2)
                        : const Color(0xFF3B82F6).withValues(alpha: 0.12),
                  ),
                  child: Icon(
                    _isCanceling ? Icons.delete_outline_rounded : Icons.mic_rounded,
                    size: 38,
                    color: _isCanceling ? Colors.white : const Color(0xFF3B82F6),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  _isCanceling
                      ? '松开手指，取消发送'
                      : (_liveWords.isEmpty ? '正在倾听中...' : _liveWords),
                  textAlign: TextAlign.center,
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: _isCanceling ? Colors.white : const Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _isCanceling
                        ? Colors.white.withValues(alpha: 0.25)
                        : Colors.grey.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _isCanceling ? '松开取消' : '松开发送，上滑取消',
                    style: TextStyle(
                      fontSize: 12,
                      color: _isCanceling ? Colors.white : Colors.grey.shade600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
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

    return Stack(
      children: [
        Column(
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
                  reverse: true,
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

                    // reverse: 0 就是最新一条
                    final msg = _messages[_messages.length - 1 - i];
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
                            child: Column(
                              crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                              children: [
                                if (!isUser)
                                  Padding(
                                    padding: const EdgeInsets.only(left: 2, bottom: 4),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF3B82F6).withValues(alpha: isDark ? 0.22 : 0.10),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.35)),
                                      ),
                                      child: const Text('天机助手',
                                          style: TextStyle(fontSize: 10.5, color: Color(0xFF60A5FA))),
                                    ),
                                  ),
                                GestureDetector(
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
                                const SizedBox(height: 3),
                                Text(
                                  DateFormat('HH:mm').format(msg.at),
                                  style: TextStyle(fontSize: 10, color: Colors.white.withValues(alpha: 0.28)),
                                ),
                              ],
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

        // 底部输入条：与世界同款一体化胶囊（左相机 / 中打字或按住说话 / 右模式切换+长按语音+发送）
        Container(
          padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF12131A) : const Color(0xFFF8FAFC),
            border: Border(top: BorderSide(color: Colors.grey.withValues(alpha: 0.12))),
          ),
          child: SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1C202B) : Colors.white,
                borderRadius: BorderRadius.circular(26),
                border: Border.all(
                  color: (_isVoiceMode && _isHoldingRecord)
                      ? const Color(0xFF3B82F6)
                      : Colors.grey.withValues(alpha: 0.18),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  IconButton(
                    tooltip: '发一张图给助手看',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    icon: Icon(
                      _imageBase64 != null ? Icons.image_rounded : Icons.camera_alt_outlined,
                      size: 22,
                      color: _imageBase64 != null ? const Color(0xFF3B82F6) : const Color(0xFF94A3B8),
                    ),
                    onPressed: _pickImage,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: _isVoiceMode
                        ? Listener(
                            onPointerDown: (_) => _onVoiceStart(),
                            onPointerMove: (e) => _onVoiceMove(e.localPosition),
                            onPointerUp: (_) => _onVoiceEnd(),
                            onPointerCancel: (_) => _onVoiceCancel(),
                            behavior: HitTestBehavior.opaque,
                            child: Container(
                              height: 40,
                              alignment: Alignment.center,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    _isHoldingRecord ? Icons.mic : Icons.mic_none_rounded,
                                    size: 19,
                                    color: _isHoldingRecord
                                        ? const Color(0xFF3B82F6)
                                        : const Color(0xFF94A3B8),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    _isHoldingRecord ? '松开 发送' : '按住 说话',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                      color: _isHoldingRecord
                                          ? const Color(0xFF3B82F6)
                                          : (isDark ? Colors.white70 : const Color(0xFF1E293B)),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : TextField(
                            controller: _inputController,
                            maxLines: 4,
                            minLines: 1,
                            textInputAction: TextInputAction.send,
                            onSubmitted: (_) => _sendMessage(),
                            onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
                            style: TextStyle(fontSize: 15, color: isDark ? Colors.white : const Color(0xFF1E293B)),
                            decoration: InputDecoration(
                              hintText: '发消息或按住说话...',
                              hintStyle: TextStyle(fontSize: 14.5, color: isDark ? Colors.white38 : Colors.grey.shade400),
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
                            ),
                          ),
                  ),
                  const SizedBox(width: 4),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _inputController,
                    builder: (ctx, v, _) {
                      final has = v.text.trim().isNotEmpty && !_isVoiceMode;
                      if (has || _isLoading) {
                        return GestureDetector(
                          onTap: _isLoading ? null : _sendMessage,
                          child: Container(
                            width: 34,
                            height: 34,
                            margin: const EdgeInsets.only(right: 2),
                            decoration: const BoxDecoration(
                              color: Color(0xFF3B82F6),
                              shape: BoxShape.circle,
                            ),
                            child: _isLoading
                                ? const Padding(
                                    padding: EdgeInsets.all(8.0),
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation(Colors.white),
                                    ),
                                  )
                                : const Icon(
                                    Icons.arrow_upward_rounded,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                          ),
                        );
                      }

                      // 空文字状态：声波/键盘切换按钮，且支持直接按住说话
                      return Listener(
                        onPointerDown: (_) {
                          if (!_isVoiceMode) {
                            _onVoiceStart();
                          }
                        },
                        onPointerMove: (e) {
                          if (!_isVoiceMode) {
                            _onVoiceMove(e.localPosition);
                          }
                        },
                        onPointerUp: (_) {
                          if (!_isVoiceMode) {
                            _onVoiceEnd();
                          }
                        },
                        onPointerCancel: (_) {
                          if (!_isVoiceMode) {
                            _onVoiceCancel();
                          }
                        },
                        child: IconButton(
                          tooltip: _isVoiceMode ? '切换打字' : '按住说话或点击切换',
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                          icon: Icon(
                            _isVoiceMode
                                ? Icons.keyboard_outlined
                                : (_isHoldingRecord ? Icons.mic_rounded : Icons.graphic_eq_rounded),
                            size: 22,
                            color: _isHoldingRecord
                                ? const Color(0xFF3B82F6)
                                : const Color(0xFF94A3B8),
                          ),
                          onPressed: () {
                            HapticFeedback.selectionClick();
                            setState(() {
                              _isVoiceMode = !_isVoiceMode;
                            });
                          },
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    ),
    if (_isHoldingRecord) _buildVoiceHoldingModal(),
  ],
);
  }
}
