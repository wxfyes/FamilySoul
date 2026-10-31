import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../providers/chat_provider.dart';
import '../widgets/message_bubble.dart';
import 'settings_screen.dart';
import 'video_call_screen.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final stt.SpeechToText _speech = stt.SpeechToText();
  final ImagePicker _imagePicker = ImagePicker();
  bool _speechAvailable = false;
  String _currentLocaleId = 'zh_CN';

  // 豆包风格语音按住说话状态
  bool _isVoiceMode = false; // 是否处于底部按住说话大按钮模式
  bool _isHoldingRecord = false; // 是否当前正按住录音
  bool _isSettling = false; // 是否处于松手后等待最后一段识别文本冲刷结算的缓冲窗口
  bool _isCanceling = false; // 是否上滑进入取消模式
  String _liveWords = ''; // 实时识别文字
  DateTime? _voiceStartTime;

  @override
  void initState() {
    super.initState();
    _initSpeech();
  }

  void _initSpeech() async {
    try {
      _speechAvailable = await _speech.initialize(
        onError: (val) {
          debugPrint('[STT] 语音识别报错: ${val.errorMsg} (permanent: ${val.permanent})');
          final isFatal = val.permanent ||
              val.errorMsg.contains('insufficient') ||
              val.errorMsg.contains('busy') ||
              val.errorMsg.contains('client');

          if (mounted) {
            if (isFatal && (_isHoldingRecord || _isSettling)) {
              setState(() {
                _isHoldingRecord = false;
                _isSettling = false;
              });
            }
            ScaffoldMessenger.of(context).hideCurrentSnackBar();
            if (val.errorMsg == 'error_permission') {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('当前手机未内置可用语音转文字引擎，可点左侧切换键盘直接用输入法说哦～'),
                  duration: Duration(seconds: 4),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    '语音提示: ${val.errorMsg}${val.permanent ? " (系统服务不可用)" : ""}',
                  ),
                  duration: const Duration(seconds: 2),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          }
        },
        onStatus: (val) {
          debugPrint('[STT] 语音引擎状态变更: $val');
        },
      );
      if (_speechAvailable) {
        try {
          final systemLocale = await _speech.systemLocale();
          final locales = await _speech.locales();
          // 优先寻找包含 zh 的中文普通话语言模型
          stt.LocaleName? targetLocale;
          for (final loc in locales) {
            final id = loc.localeId.toLowerCase().replaceAll('_', '-');
            if (id.startsWith('zh-cn') || id == 'zh-hans' || id == 'zh') {
              targetLocale = loc;
              break;
            }
          }
          targetLocale ??= locales.cast<stt.LocaleName?>().firstWhere(
            (loc) => loc?.localeId.toLowerCase().startsWith('zh') ?? false,
            orElse: () => null,
          );
          if (targetLocale != null) {
            _currentLocaleId = targetLocale.localeId;
          } else if (systemLocale != null && systemLocale.localeId.toLowerCase().startsWith('zh')) {
            _currentLocaleId = systemLocale.localeId;
          } else {
            _currentLocaleId = ''; // 留空则使用系统默认语音模型，兼容性最好
          }
          debugPrint('[STT] 语音识别就绪，选定模型: ${_currentLocaleId.isEmpty ? "系统默认" : _currentLocaleId}');
        } catch (e) {
          debugPrint('[STT] 获取语言模型失败，降级系统默认: $e');
          _currentLocaleId = '';
        }
      }
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint('[STT] 初始化异常: $e');
      _speechAvailable = false;
    }
  }

  /// 按下开始录音（豆包模式）
  void _onVoiceStart() async {
    // 防重入：正在录音中或正在松手结算中直接忽略，杜绝 Android 原生 client error 5
    if (_isHoldingRecord || _isSettling) return;

    // 主动检查并申请麦克风权限
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

    if (!_speechAvailable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('语音服务未就绪，请在手机设置中检查是否授予麦克风权限...'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
      _initSpeech();
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
          // 只要处于按住录音中或松手结算缓冲窗口内，都允许刷入最新识别文本
          if (_isHoldingRecord || _isSettling) {
            setState(() {
              _liveWords = result.recognizedWords;
            });
          }
        },
        listenOptions: stt.SpeechListenOptions(
          // 使用 confirmation 模式，Android 兼容性远优于 dictation（避免因不支持连续听写直接报错闪退）
          listenMode: stt.ListenMode.confirmation,
          cancelOnError: false,
          partialResults: true,
          autoPunctuation: true,
          localeId: _currentLocaleId.isNotEmpty ? _currentLocaleId : null,
        ),
      );
    } catch (e) {
      debugPrint('[STT] 启动录音异常: $e');
      if (mounted) {
        setState(() {
          _isHoldingRecord = false;
          _isSettling = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('启动录音失败: $e (建议检查系统麦克风权限)'),
            duration: const Duration(seconds: 3),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  /// 手势滑动中：检测上滑取消
  void _onVoiceMove(Offset localPosition) {
    if (!_isHoldingRecord) return;
    // 当手指向上滑动超过 50 像素时判定为上滑取消
    final shouldCancel = localPosition.dy < -50;
    if (shouldCancel != _isCanceling) {
      HapticFeedback.selectionClick();
      setState(() => _isCanceling = shouldCancel);
    }
  }

  /// 异常打断或取消手势
  void _onVoiceCancel() async {
    if (!_isHoldingRecord && !_isSettling) return;
    try {
      await _speech.stop();
    } catch (_) {}
    if (mounted) {
      setState(() {
        _isHoldingRecord = false;
        _isCanceling = false;
        _isSettling = false;
      });
    }
  }

  /// 松手结束录音并自动发送（豆包模式）
  void _onVoiceEnd() async {
    if (!_isHoldingRecord) return;

    final wasCanceling = _isCanceling;
    final duration = DateTime.now().difference(_voiceStartTime ?? DateTime.now());

    HapticFeedback.lightImpact();

    // 关键优化：手指已松开，但开启结算窗口 _isSettling = true，确保 Android 底层异步吐出的最终分词不被拦截
    setState(() {
      _isHoldingRecord = false;
      _isCanceling = false;
      _isSettling = true;
    });

    try {
      await _speech.stop();
    } catch (_) {}

    if (!mounted) {
      _isSettling = false;
      return;
    }

    // 1. 用户主动上滑取消
    if (wasCanceling) {
      _isSettling = false;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('已取消发送'),
          duration: Duration(milliseconds: 1000),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // 2. 录音时间太短（小于 500ms）
    if (duration.inMilliseconds < 500) {
      _isSettling = false;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('说话时间太短'),
          duration: Duration(milliseconds: 1000),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // 缓冲 350ms 确保 Android 系统底层在 stop 后的异步最终分词刷回
    await Future.delayed(const Duration(milliseconds: 350));
    if (!mounted) {
      _isSettling = false;
      return;
    }
    _isSettling = false;

    final textToSend = _liveWords.trim();
    if (textToSend.isNotEmpty) {
      final provider = context.read<ChatProvider>();
      provider.sendMessage(textToSend);
      _scrollToBottom();
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

  /// 弹出拍照或选择照片看脸 BottomSheet
  void _showPhotoSourceSheet() {
    HapticFeedback.selectionClick();
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF8B5CF6).withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.face_retouching_natural_rounded, color: Color(0xFF8B5CF6), size: 24),
                  ),
                  const SizedBox(width: 12),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('上传照片看脸 · 肤质气色端详', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      SizedBox(height: 2),
                      Text('Gemini 视觉大脑为你专业分析面容、肤质与气色', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 18),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.camera_alt_rounded, color: Color(0xFF8B5CF6)),
                ),
                title: const Text('拍照看脸 / 肤质 / 穿搭', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('即时自拍，伴侣实时端详为你量身建议'),
                contentPadding: EdgeInsets.zero,
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndSendImage(ImageSource.camera);
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.blue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.photo_library_rounded, color: Colors.blue),
                ),
                title: const Text('从手机相册选取', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('选择手机相册中的精修照片或特写'),
                contentPadding: EdgeInsets.zero,
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndSendImage(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 拍照或选取并发送
  Future<void> _pickAndSendImage(ImageSource source) async {
    try {
      final picked = await _imagePicker.pickImage(
        source: source,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 85,
      );
      if (picked == null) return;

      if (!mounted) return;
      final provider = context.read<ChatProvider>();
      final promptText = _textController.text.trim();
      _textController.clear();

      await provider.sendImageMessage(
        filePath: picked.path,
        text: promptText.isNotEmpty ? promptText : '帮我仔细端详看看照片里的肤质、脸色和整体气色，给出建议',
      );
      _scrollToBottom();
    } catch (e) {
      debugPrint('[ImagePicker] 选取照片异常: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('选择照片失败: $e'), behavior: SnackBarBehavior.floating),
        );
      }
    }
  }

  @override
  void dispose() {
    _speech.stop();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _handleSend() {
    final text = _textController.text.trim();
    if (text.isEmpty) return;

    final provider = context.read<ChatProvider>();
    _textController.clear();
    provider.sendMessage(text);
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ChatProvider>();
    final isOnline = provider.isConnected;
    final characterName = provider.petStatus.characterName;
    final statusText = isOnline ? provider.petStatus.presenceState : '离线中';

    // 监听消息变化自动滚到底部
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (provider.messages.isNotEmpty) {
        _scrollToBottom();
      }
    });

    return Scaffold(
      appBar: AppBar(
        elevation: 0.5,
        titleSpacing: 0,
        title: Row(
          children: [
            const SizedBox(width: 16),
            Stack(
              alignment: Alignment.bottomRight,
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFF8B5CF6),
                  radius: 19,
                  child: Text(
                    characterName.isNotEmpty ? characterName.characters.first : 'A',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
                Container(
                  width: 11,
                  height: 11,
                  decoration: BoxDecoration(
                    color: isOnline ? const Color(0xFF22C55E) : Colors.grey,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    characterName,
                    style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 12,
                      color: isOnline ? const Color(0xFF16A34A) : Colors.grey,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // 豆包同款语音播报开关（开启才请求火山TTS，关闭省额度）
          IconButton(
            icon: Icon(
              provider.isVoiceReplyEnabled ? Icons.volume_up_rounded : Icons.volume_off_rounded,
              color: provider.isVoiceReplyEnabled ? const Color(0xFF8B5CF6) : Colors.grey,
            ),
            tooltip: provider.isVoiceReplyEnabled ? '语音播报: 已开启 (调用火山TTS)' : '语音播报: 已关闭 (省额度)',
            onPressed: () {
              HapticFeedback.mediumImpact();
              final willEnable = !provider.isVoiceReplyEnabled;
              provider.toggleVoiceReply();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    willEnable
                        ? '🎙️ 已开启小娘子语音播放（调用火山引擎合成）'
                        : '🔇 已关闭语音播放（纯文本回复，不消耗火山额度）',
                  ),
                  duration: const Duration(milliseconds: 1500),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),
          // 📹 闺房视讯·视频通话
          IconButton(
            icon: const Icon(Icons.videocam_rounded, color: Color(0xFF8B5CF6)),
            tooltip: '发起闺房视频通话',
            onPressed: () {
              HapticFeedback.mediumImpact();
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const VideoCallScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: '服务器配置',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                if (!isOnline && provider.isInitialized)
                  GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const SettingsScreen()),
                      );
                    },
                    child: Container(
                      width: double.infinity,
                      color: const Color(0xFFFEF2F2),
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                      child: const Row(
                        children: [
                          Icon(Icons.cloud_off, color: Color(0xFFDC2626), size: 18),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '未连接到小主机服务器，点击前往配置 IP 与 Token',
                              style: TextStyle(color: Color(0xFF991B1B), fontSize: 13),
                            ),
                          ),
                          Icon(Icons.chevron_right, color: Color(0xFF991B1B), size: 18),
                        ],
                      ),
                    ),
                  ),
                Expanded(
                  child: provider.messages.isEmpty
                      ? _buildEmptyState(characterName)
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          itemCount: provider.messages.length,
                          itemBuilder: (context, index) {
                            final msg = provider.messages[index];
                            return MessageBubble(
                              message: msg,
                              characterName: characterName,
                            );
                          },
                        ),
                ),
                _buildInputArea(provider),
              ],
            ),

            // 豆包风格屏幕中央按住说话悬浮弹窗
            if (_isHoldingRecord) _buildVoiceHoldingModal(),
          ],
        ),
      ),
    );
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
                        : const Color(0xFF8B5CF6).withValues(alpha: 0.12),
                  ),
                  child: Icon(
                    _isCanceling ? Icons.delete_outline_rounded : Icons.mic_rounded,
                    size: 38,
                    color: _isCanceling ? Colors.white : const Color(0xFF8B5CF6),
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

  Widget _buildEmptyState(String name) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.12),
              ),
              child: const Icon(Icons.auto_awesome, size: 48, color: Color(0xFF8B5CF6)),
            ),
            const SizedBox(height: 18),
            Text(
              '你的赛博伴侣「$name」已就位',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              '已打通记忆卡、作息节律与独立通信通道。\n发句问候开启对话吧～',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInputArea(ChatProvider provider) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 8.0),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        border: Border(top: BorderSide(color: Colors.grey.withValues(alpha: 0.15))),
      ),
      child: Row(
        children: [
          // 左侧：切换“按住说话”模式与“打字”模式
          IconButton(
            onPressed: () {
              HapticFeedback.selectionClick();
              setState(() {
                _isVoiceMode = !_isVoiceMode;
              });
            },
            icon: Icon(
              _isVoiceMode ? Icons.keyboard_alt_outlined : Icons.mic_none_rounded,
              color: const Color(0xFF8B5CF6),
              size: 26,
            ),
            tooltip: _isVoiceMode ? '切换打字' : '切换按住说话',
          ),
          // 上传照片看脸 / 肤质 / 穿搭
          IconButton(
            onPressed: _showPhotoSourceSheet,
            icon: const Icon(
              Icons.camera_alt_outlined,
              color: Color(0xFF8B5CF6),
              size: 25,
            ),
            tooltip: '拍照看脸 / 肤质端详',
          ),
          const SizedBox(width: 4),

          // 中间区域：按住说话大按钮 OR 文本输入框
          Expanded(
            child: _isVoiceMode
                ? Listener(
                    onPointerDown: (_) => _onVoiceStart(),
                    onPointerMove: (e) => _onVoiceMove(e.localPosition),
                    onPointerUp: (_) => _onVoiceEnd(),
                    onPointerCancel: (_) => _onVoiceCancel(),
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        gradient: _isHoldingRecord
                            ? const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFFA855F7)])
                            : null,
                        color: _isHoldingRecord ? null : Theme.of(context).scaffoldBackgroundColor,
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(
                          color: _isHoldingRecord
                              ? const Color(0xFF8B5CF6)
                              : Colors.grey.withValues(alpha: 0.25),
                          width: 1.2,
                        ),
                        boxShadow: _isHoldingRecord
                            ? [
                                BoxShadow(
                                  color: const Color(0xFF8B5CF6).withValues(alpha: 0.35),
                                  blurRadius: 10,
                                  offset: const Offset(0, 3),
                                ),
                              ]
                            : null,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _isHoldingRecord ? Icons.mic : Icons.mic_rounded,
                            size: 20,
                            color: _isHoldingRecord ? Colors.white : const Color(0xFF8B5CF6),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _isHoldingRecord ? '松开 发送' : '按住 说话',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: _isHoldingRecord ? Colors.white : Colors.grey.shade800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    decoration: BoxDecoration(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: TextField(
                      controller: _textController,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _handleSend(),
                      decoration: const InputDecoration(
                        hintText: '发消息，或点左侧切换按住说话...',
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
          ),
          const SizedBox(width: 8),

          // 右侧：打字发送按钮
          IconButton.filled(
            onPressed: provider.isSending ? null : _handleSend,
            style: IconButton.styleFrom(
              backgroundColor: const Color(0xFF8B5CF6),
              shape: const CircleBorder(),
            ),
            icon: provider.isSending
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(Colors.white),
                    ),
                  )
                : const Icon(Icons.arrow_upward_rounded, color: Colors.white),
          ),
        ],
      ),
    );
  }
}

