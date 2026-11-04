import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../providers/chat_provider.dart';
import '../services/offline_asr_service.dart';
import '../widgets/message_bubble.dart';
import 'settings_screen.dart';
import 'my_world_screen.dart';
import 'out_and_about_sheet.dart';
import 'video_call_screen.dart';
import 'assistant_view.dart';
import '../widgets/register_dialog.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final FocusNode _inputFocus = FocusNode();
  int _lastMessageCount = 0;
  int _activeDomainIndex = 0; // 0: 宿命乾坤 (虚拟世界), 1: 天机助手 (纯问答解耦)
  String _lastContentSig = '';
  bool _hasScrolledToBottomInitially = false;
  bool _hasCheckedToken = false;
  final ScrollController _scrollController = ScrollController();
  final stt.SpeechToText _speech = stt.SpeechToText();
  final ImagePicker _imagePicker = ImagePicker();
  final AudioRecorder _audioRecorder = AudioRecorder();
  String? _currentRecordPath;
  bool _speechAvailable = false;
  final bool _usingFallbackRecorder = false;
  String _currentLocaleId = 'zh_CN';

  // 首页位置条：随时知道自己在哪
  String _placeName = '';
  int _worldDay = 0;
  int _worldHour = 0;
  Timer? _locTimer;
  List<String> _partyNames = const [];
  List<String> _hereNames = const [];
  String _homeName = '';
  Map? _pendingAction;

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
    _refreshPlace();
    _locTimer = Timer.periodic(const Duration(seconds: 30), (_) => _refreshPlace());
    if (Platform.isAndroid) {
      OfflineAsrService.instance.ensureInitialized();
    } else {
      _initSpeech();
    }
  }

  Future<void> _initSpeech() async {
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

    // Android 端：直接调用 APK 内置 Sherpa-ONNX 纯离线中文流式语音包（零网络、零代理、边说边出字）
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

    // iOS 端：100% 保持原汁原味 Apple Speech 原生离线引擎
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

    if (_usingFallbackRecorder) {
      try {
        final path = await _audioRecorder.stop();
        if (path != null) {
          try {
            File(path).deleteSync();
          } catch (_) {}
        }
      } catch (_) {}
      if (mounted) {
        setState(() {
          _isHoldingRecord = false;
          _isCanceling = false;
          _isSettling = false;
        });
      }
      return;
    }

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

    // Android 端：直传中枢模式
    if (_usingFallbackRecorder) {
      String? recordPath;
      try {
        recordPath = await _audioRecorder.stop();
      } catch (_) {}

      setState(() {
        _isHoldingRecord = false;
        _isCanceling = false;
        _isSettling = false;
      });

      if (!mounted) return;

      if (wasCanceling) {
        if (recordPath != null) {
          try {
            File(recordPath).deleteSync();
          } catch (_) {}
        }
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
        if (recordPath != null) {
          try {
            File(recordPath).deleteSync();
          } catch (_) {}
        }
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('说话时间太短'),
            duration: Duration(milliseconds: 1000),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }

      final targetFile = recordPath ?? _currentRecordPath;
      if (targetFile != null && File(targetFile).existsSync()) {
        final provider = context.read<ChatProvider>();
        await provider.sendVoiceAudioMessage(targetFile);
        _scrollToBottom();
      }
      return;
    }

    // iOS 端：保持原汁原味 Apple Speech 本地听写逻辑，绝对不改动！
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
                      Text('发送图片 · 视觉万物识别', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      SizedBox(height: 2),
                      Text('拍照或发图，伴侣亲眼看清图中内容并听候询问', style: TextStyle(fontSize: 12, color: Colors.grey)),
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
                title: const Text('拍照发送', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('拍下眼前画面、物品、文字或自拍'),
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
                subtitle: const Text('发送相册中的任意图片、截图或照片'),
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
        text: promptText,
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

  Future<void> _refreshPlace() async {
    // 本地没有历史时，请天道把"落地第一幕"补上（只成功一次）
    ChatProvider? provider0;
    try { provider0 = context.read<ChatProvider>(); } catch (_) {}
    try {
      if (provider0 != null && provider0.messages.isEmpty) {
        await provider0.ensureOpening();
      }
    } catch (_) {}
    final api0 = provider0?.api;

    try {
      final d = await api0?.fetchMyWorld();
      if (!mounted || d == null) return;
      final self = (d['self'] is Map) ? d['self'] as Map : const {};
      final date = (d['date'] is Map) ? d['date'] as Map : const {};
      final place = (self['place'] ?? '').toString();
      if (place.isEmpty) return;
      // 同行的人
      List<String> names = const [];
      final party = d['party'];
      if (party is Map) {
        if (party['names'] is List) {
          names = (party['names'] as List).map((x) => x.toString()).where((x) => x.isNotEmpty).toList();
        } else if (party['members'] is List && (party['members'] as List).isNotEmpty) {
          // 相公视角只有 id，这里退回用 id 展示
          names = (party['members'] as List).map((x) => x.toString()).toList();
        }
      }
      final day = (date['day'] ?? 0) is int ? date['day'] as int : int.tryParse('${date['day']}') ?? 0;
      final hour = (date['hour'] ?? 0) is int ? date['hour'] as int : int.tryParse('${date['hour']}') ?? 0;
      // 此处有谁
      List<String> here = const [];
      if (d['here'] is List) {
        here = (d['here'] as List)
            .map((x) => (x is Map) ? (x['name'] ?? '').toString() : '')
            .where((x) => x.isNotEmpty)
            .toList();
      }
      final homeName2 = (self['homeName'] ?? '').toString();
      final pend = (d['pendingAction'] is Map) ? d['pendingAction'] as Map : null;
      if (place != _placeName || day != _worldDay || hour != _worldHour
          || here.join(',') != _hereNames.join(',')
          || '${pend?['id']}' != '${_pendingAction?['id']}') {
        setState(() {
          _placeName = place;
          _worldDay = day;
          _worldHour = hour;
          _partyNames = names;
          _hereNames = here;
          _homeName = homeName2;
          _pendingAction = pend;
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _locTimer?.cancel();
    _speech.stop();
    _audioRecorder.dispose();
    _textController.dispose();
    _inputFocus.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  /// 只有本来就贴着底部时才自动滚动，避免你翻历史时被强行拽下去
  bool _isNearBottom({double threshold = 120}) {
    if (!_scrollController.hasClients) return true;
    final pos = _scrollController.position;
    return (pos.maxScrollExtent - pos.pixels) < threshold;
  }

  /// 滚到底。是否该滚由调用方在「布局之前」判断，这里不再重复判断。
  void _jumpToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
    });
  }

  void _scrollToBottom({bool force = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  void _handleSend() {
    final text = _textController.text.trim();
    if (text.isEmpty) return;

    final provider = context.read<ChatProvider>();
    // 上一条还在发送中：保留输入内容，别把用户打好的字吞掉
    if (provider.isSending) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('上一条还在发送，稍等一下'), duration: Duration(seconds: 1)),
      );
      return;
    }

    _textController.clear();
    provider.sendMessage(text);
    _scrollToBottom(force: true);

    // 发完立刻把焦点还给输入框：否则每次都要再点一下才能打字
    _refocusInput();
  }

  /// 把焦点还给输入框（带下一帧重试，避免键盘收起后焦点丢失）
  void _refocusInput() {
    void tryFocus() {
      if (!mounted) return;
      if (!_inputFocus.hasFocus) _inputFocus.requestFocus();
    }

    tryFocus();
    WidgetsBinding.instance.addPostFrameCallback((_) => tryFocus());
    Future.delayed(const Duration(milliseconds: 120), tryFocus);
  }


  /// 豆包式抽屉：头像 + 位置 + 收纳所有入口（出门/世界/视讯/语音/设置）
  Widget _buildDomainTab(int index, String label) {
    final isSelected = _activeDomainIndex == index;
    return GestureDetector(
      onTap: () {
        if (_activeDomainIndex != index) {
          HapticFeedback.selectionClick();
          setState(() {
            _activeDomainIndex = index;
          });
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF8B5CF6) : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected
                ? Colors.white
                : (Theme.of(context).brightness == Brightness.dark ? Colors.white70 : const Color(0xFF475569)),
          ),
        ),
      ),
    );
  }

  Widget _buildDrawer(BuildContext context, ChatProvider provider) {
    final name = provider.petStatus.characterName;
    return Drawer(
      backgroundColor: const Color(0xFF15171F),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── 头部：头像 + 名字 + 此刻位置 ──
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 22, 18, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: const Color(0xFF8B5CF6),
                        child: Text(
                          name.isNotEmpty ? name.characters.first : '我',
                          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 2),
                            FutureBuilder<Map<String, dynamic>?>(
                              future: provider.api.fetchMyWorld(),
                              builder: (context, snap) {
                                final self = (snap.data?['self'] is Map) ? snap.data!['self'] as Map : const {};
                                final place = (self['place'] ?? '').toString();
                                final day = (snap.data?['date'] is Map) ? snap.data!['date'] as Map : const {};
                                final txt = place.isEmpty
                                    ? '正在确认你在哪儿…'
                                    : '$place · 第${day['day'] ?? '-'}日 ${day['hour'] ?? '-'}时';
                                return Text(txt, style: const TextStyle(color: Colors.white54, fontSize: 12));
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Colors.white10),

            // ── 主入口 ──
            ListTile(
              leading: const Icon(Icons.explore_outlined, color: Color(0xFF8B5CF6)),
              title: const Text('出门 · 找人 · 赴约', style: TextStyle(color: Colors.white)),
              subtitle: const Text('去哪儿、叫谁来、赴哪个约', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
              onTap: () {
                Navigator.pop(context);
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => OutAndAboutSheet(api: provider.api),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.payments_rounded, color: Color(0xFFE0B252)),
              title: const Text('记一笔花销', style: TextStyle(color: Colors.white)),
              subtitle: const Text('房钱 · 货款 · 打点 · 赏银', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
              onTap: () async {
                final messengerP = ScaffoldMessenger.of(context);
                Navigator.pop(context);
                final ctrlA = TextEditingController();
                final ctrlT = TextEditingController(text: '花销');
                final navCtx = context;
                final ok = await showDialog<bool>(
                  context: navCtx,
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
                  messengerP.showSnackBar(
                    SnackBar(content: Text(line), duration: const Duration(milliseconds: 2200), behavior: SnackBarBehavior.floating),
                  );
                  _refreshPlace();
                }
              },
            ),
            ListTile(
              leading: const Icon(Icons.public_rounded, color: Colors.white70),
              title: const Text('我的世界', style: TextStyle(color: Colors.white)),
              subtitle: const Text('时辰 · 家底 · 待办 · 线索', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => MyWorldScreen(api: provider.api), fullscreenDialog: true),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.videocam_rounded, color: Color(0xFF8B5CF6)),
              title: const Text('闺房视讯', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const VideoCallScreen()));
              },
            ),
            const Divider(height: 1, color: Colors.white10),

            // ── 语音与设置 ──
            SwitchListTile(
              secondary: Icon(
                provider.isVoiceReplyEnabled ? Icons.volume_up_rounded : Icons.volume_off_rounded,
                color: provider.isVoiceReplyEnabled ? const Color(0xFF8B5CF6) : Colors.white38,
              ),
              title: const Text('语音播报', style: TextStyle(color: Colors.white)),
              subtitle: Text(
                provider.isVoiceReplyEnabled ? '开启（消耗火山额度）' : '关闭（省额度）',
                style: const TextStyle(color: Colors.white38, fontSize: 11.5),
              ),
              value: provider.isVoiceReplyEnabled,
              activeColor: const Color(0xFF8B5CF6),
              onChanged: (_) => provider.toggleVoiceReply(),
            ),
            ListTile(
              leading: const Icon(Icons.person_add_alt_1_rounded, color: Color(0xFF38BDF8)),
              title: const Text('初入江湖 · 立牒入世', style: TextStyle(color: Colors.white)),
              subtitle: const Text('建新角色 · 姓名性别岁数 · 投身客栈', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
              onTap: () {
                final scaffoldMessenger = ScaffoldMessenger.of(context);
                Navigator.pop(context);
                showDialog(
                  context: context,
                  builder: (_) => RegisterDialog(
                    apiClient: provider.api,
                    onRegistered: (token, actorId, name) async {
                      final newConfig = provider.config.copyWith(token: token);
                      await provider.saveConfig(newConfig);
                      scaffoldMessenger.showSnackBar(
                        SnackBar(content: Text('欢迎【$name】立牒入世，已落脚临江客栈！')),
                      );
                      _refreshPlace();
                    },
                  ),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.settings_outlined, color: Colors.white70),
              title: const Text('设置', style: TextStyle(color: Colors.white)),
              subtitle: const Text('服务器 · 令牌 · 备份 · 作息', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
              },
            ),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                '世界在走，不必等谁',
                style: TextStyle(color: Colors.white24, fontSize: 11.5),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }

    void _openRegisterDialog(BuildContext context, ChatProvider provider) {
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => RegisterDialog(
        apiClient: provider.api,
        onRegistered: (token, actorId, name) async {
          final newConfig = provider.config.copyWith(token: token);
          await provider.saveConfig(newConfig);
          scaffoldMessenger.showSnackBar(
            SnackBar(content: Text('欢迎【】立牒入世，已落脚临江客栈！')),
          );
          _refreshPlace();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ChatProvider>();
    final isOnline = provider.isConnected;
    final characterName = provider.petStatus.characterName;


    // 冷启动未设置 token 时自动弹出立牒入世名册
    if (provider.isInitialized && provider.config.token.trim().isEmpty && !_hasCheckedToken) {
      _hasCheckedToken = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _openRegisterDialog(context, provider);
      });
    }

    // 关键：首次加载出历史消息时，无条件直接 jumpTo 最底部！告别滑半天！
    if (!_hasScrolledToBottomInitially && provider.messages.isNotEmpty) {
      _hasScrolledToBottomInitially = true;
      _jumpToBottom();
      Future.delayed(const Duration(milliseconds: 150), () {
        if (mounted) _jumpToBottom();
      });
      Future.delayed(const Duration(milliseconds: 350), () {
        if (mounted) _jumpToBottom();
      });
    }

    // 关键：必须在「新内容布局之前」判断当时是否贴在底部。
    // 放进 postFrame 再判断就晚了——新消息已经把列表撑长，永远会被判成"不在底部"。
    final wasAtBottom = _isNearBottom();
    final messageCount = provider.messages.length;

    // 光看条数不够：回复是把「正在思考…」那条【替换】掉，条数不变、内容变长。
    // 所以用「最后一条的 id + 文字长度 + 是否思考中」做签名，签名一变就滚。
    final last = provider.messages.isEmpty ? null : provider.messages.last;
    final lastSig = last == null ? '' : '${last.id}|${last.text.length}|${last.isPending}';
    final contentChanged = lastSig != _lastContentSig;
    final countChanged = messageCount != _lastMessageCount;
    _lastContentSig = lastSig;
    _lastMessageCount = messageCount;

    if (wasAtBottom && (countChanged || contentChanged)) {
      _scrollToBottom();
      // 图片、语音条、多行文本会二次撑高布局，再来一次兜底
      Future.delayed(const Duration(milliseconds: 260), () {
        if (mounted && _isNearBottom(threshold: 400)) _scrollToBottom();
      });
    }

    return Scaffold(
      drawer: _buildDrawer(context, provider),
      appBar: AppBar(
        elevation: 0.5,
        titleSpacing: 0,
        centerTitle: true,
        title: Container(
          height: 32,
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: Theme.of(context).brightness == Brightness.dark
                ? const Color(0xFF0F172A)
                : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.withValues(alpha: 0.15)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDomainTab(0, '🌸 宿命乾坤'),
              _buildDomainTab(1, '🤖 天机助手'),
            ],
          ),
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
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: _activeDomainIndex == 1
            ? AssistantView(apiClient: provider.api)
            : Stack(
                children: [
            Column(
              children: [
                // 📍 位置条：随时知道自己在哪（点一下＝出门）
                InkWell(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => OutAndAboutSheet(api: provider.api, onChanged: _refreshPlace),
                    ).then((_) => _refreshPlace());
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    color: const Color(0xFF1B1E28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                      children: [
                        const Icon(Icons.place_rounded, size: 15, color: Color(0xFF8B5CF6)),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            _placeName.isEmpty ? '定位中…' : _placeName,
                            style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (_homeName.isNotEmpty && _placeName != _homeName)
                          Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: InkWell(
                              onTap: () async {
                                HapticFeedback.lightImpact();
                                final messenger = ScaffoldMessenger.of(context);
                                final line = await provider.api.goTo(_homeName);
                                if (!mounted) return;
                                _refreshPlace();
                                if (line != null) {
                                  messenger.showSnackBar(SnackBar(
                                    content: Text(line),
                                    duration: const Duration(milliseconds: 1800),
                                    behavior: SnackBarBehavior.floating,
                                  ));
                                }
                              },
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.home_rounded, size: 14, color: Color(0xFF8B5CF6)),
                                  SizedBox(width: 2),
                                  Text('回家', style: TextStyle(color: Color(0xFF9B8CF6), fontSize: 11.5)),
                                ],
                              ),
                            ),
                          ),
                        if (_partyNames.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: Text(
                              _partyNames.length <= 2
                                  ? '与${_partyNames.join('、')}同行'
                                  : '与${_partyNames.take(2).join('、')}等${_partyNames.length}人同行',
                              style: const TextStyle(color: Color(0xFF9B8CF6), fontSize: 11.5),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        if (_worldDay > 0)
                          Text(
                            '第$_worldDay日 $_worldHour时',
                            style: const TextStyle(color: Colors.white30, fontSize: 11.5),
                          ),
                        const SizedBox(width: 4),
                        const Icon(Icons.keyboard_arrow_right_rounded, size: 15, color: Colors.white24),
                      ],
                        ),
                        // 此处有谁
                        Padding(
                          padding: const EdgeInsets.only(left: 20, top: 2),
                          child: Text(
                            _hereNames.isEmpty
                                ? '此处无人'
                                : '此处：${_hereNames.length <= 4 ? _hereNames.join('、') : '${_hereNames.take(4).join('、')}等${_hereNames.length}人'}',
                            style: const TextStyle(color: Colors.white38, fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Builder(builder: (_) {
                  if (_placeName.isEmpty) {
                    WidgetsBinding.instance.addPostFrameCallback((__) => _refreshPlace());
                  }
                  return const SizedBox.shrink();
                }),
                // 💰 待付款：要花银子的事，必须你亲手点头
                if (_pendingAction != null)
                  Container(
                    width: double.infinity,
                    color: const Color(0xFF241E12),
                    padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
                    child: Row(
                      children: [
                        const Icon(Icons.payments_rounded, size: 16, color: Color(0xFFE0B252)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '要花银子：${_pendingAction!['title'] ?? ''}',
                            style: const TextStyle(color: Color(0xFFE8C87A), fontSize: 12.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        ...(((_pendingAction!['options'] as List?) ?? const []).map((o) {
                          final opt = (o is Map) ? o : <String, dynamic>{};
                          final label = (opt['label'] ?? '').toString();
                          final price = opt['price'];
                          final key = (opt['key'] ?? label).toString();
                          return Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: TextButton(
                              style: TextButton.styleFrom(
                                backgroundColor: const Color(0xFF3A2F1A),
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              onPressed: () async {
                                HapticFeedback.lightImpact();
                                final messengerP = ScaffoldMessenger.of(context);
                                                final line = await provider.api.confirmPayment(key,
                                    actionId: _pendingAction!['id']?.toString());
                                if (!mounted) return;
                                setState(() => _pendingAction = null);
                                if (line != null) {
                                  messengerP.showSnackBar(
                                    SnackBar(content: Text(line), duration: const Duration(milliseconds: 2200), behavior: SnackBarBehavior.floating),
                                  );
                                }
                                _refreshPlace();
                              },
                              child: Text('$label $price 两',
                                  style: const TextStyle(color: Color(0xFFE8C87A), fontSize: 12)),
                            ),
                          );
                        })),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, size: 16, color: Colors.white24),
                          onPressed: () async {
                            // 不付：只清掉提示，什么都不发生
                            setState(() => _pendingAction = null);
                          },
                        ),
                      ],
                    ),
                  ),
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
                      focusNode: _inputFocus,
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





