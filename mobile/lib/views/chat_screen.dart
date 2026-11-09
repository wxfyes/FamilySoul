import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../models/chat_message.dart';
import '../providers/chat_provider.dart';
import '../services/offline_asr_service.dart';
import '../services/theme_controller.dart';
import 'digest_sheet.dart';
import '../widgets/message_bubble.dart';
import 'settings_screen.dart';
import 'my_world_screen.dart';
import 'out_and_about_sheet.dart';
import 'roster_screen.dart';
import 'army_sheet.dart';
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

  // 快捷胶囊拖拽排序与本地持久化
  static const List<String> _defaultCapsuleKeys = ['out', 'today', 'army', 'world', 'roster'];
  List<String> _capsuleOrder = List.from(_defaultCapsuleKeys);

  // 正在同屏提笔回信的信函/差事
  ChatMessage? _replyingCorrespondence;

  @override
  void initState() {
    super.initState();
    _loadCapsuleOrder();
    // 键盘弹出/收起后，若本来就在底部，自动贴到最新一条
    _inputFocus.addListener(() {
      if (_inputFocus.hasFocus) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Future<void>.delayed(const Duration(milliseconds: 260), () {
            if (mounted && _isNearBottom(threshold: 260)) _scrollToBottom(force: true);
          });
        });
      }
    });

    super.initState();
    _refreshPlace();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<ChatProvider>().onPlaceChanged = () {
          if (mounted) _refreshPlace();
        };
      }
    });
    _locTimer = Timer.periodic(const Duration(seconds: 30), (_) => _refreshPlace());
    if (Platform.isAndroid) {
      OfflineAsrService.instance.ensureInitialized();
    } else {
      _initSpeech();
    }
  }

  Future<void> _loadCapsuleOrder() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList('quick_capsules_order');
      if (list != null && list.isNotEmpty) {
        final valid = list.where((k) => _defaultCapsuleKeys.contains(k)).toList();
        for (final k in _defaultCapsuleKeys) {
          if (!valid.contains(k)) valid.add(k);
        }
        if (mounted) setState(() => _capsuleOrder = valid);
      }
    } catch (_) {}
  }

  void _onCapsuleReorder(int oldIndex, int newIndex) async {
    HapticFeedback.mediumImpact();
    setState(() {
      if (oldIndex < newIndex) newIndex -= 1;
      final item = _capsuleOrder.removeAt(oldIndex);
      _capsuleOrder.insert(newIndex, item);
    });
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList('quick_capsules_order', _capsuleOrder);
    } catch (_) {}
  }

  void _handleActionCorrespondence(String messageId, String action) async {
    final provider = context.read<ChatProvider>();
    await provider.api.actionCorrespondence(messageId, action);
    if (action == 'allow') {
      provider.updateMessageCorrespondenceStatus(messageId, 'approved');
      provider.addLocalNarrative('（相公吩咐请门外之人进门叙话。）');
    } else {
      provider.updateMessageCorrespondenceStatus(messageId, 'dismissed');
      provider.addLocalNarrative('（门房回禀：东家此刻正忙，改日再叙。）');
    }
    _refreshPlace();
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

    if (Platform.isAndroid) {
      try {
        final fin = await OfflineAsrService.instance.stopAndFinalize();
        if (fin.isNotEmpty) {
          _liveWords = fin;
        }
      } catch (_) {}
    } else {
      try {
        await _speech.stop();
      } catch (_) {}
    }

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
      if (_replyingCorrespondence != null) {
        final target = _replyingCorrespondence!;
        setState(() => _replyingCorrespondence = null);
        provider.addLocalUserReply(textToSend);
        final ok = await provider.api.replyCorrespondence(target.threadId ?? target.id, textToSend);
        if (ok) {
          provider.addLocalNarrative('（信使收下手书，快马折返向「${target.speaker ?? '对方'}」呈递。）');
        } else {
          provider.addLocalNarrative('（回信未送达，稍后可重试。）');
        }
        if (mounted) _refreshPlace();
        _scrollToBottom(force: true);
        return;
      }
      await provider.sendMessage(textToSend);
      if (mounted) _refreshPlace();
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
      final homeName2 = (self['homeName'] ?? '').toString();
      final locRaw = (self['location'] ?? '').toString();

      String place = (self['place'] ?? '').toString().trim();
      // 容错与兜底：若 place 为空或为原始英文 id（如 house_...__gate），规范化为中文「门外」，绝不留白或裸露 id
      if (place.isEmpty || place.contains('house_') || place.contains('__gate') || RegExp(r'^[a-zA-Z0-9_-]+$').hasMatch(place)) {
        if (place.contains('__gate') || locRaw.contains('__gate')) {
          place = homeName2.isNotEmpty ? '$homeName2·门外' : '宅院门外';
        } else if (place.isEmpty || RegExp(r'^[a-zA-Z0-9_-]+$').hasMatch(place)) {
          place = homeName2.isNotEmpty ? homeName2 : '门外';
        }
      }
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
      // 同步给 ChatProvider，让所有消息气泡精准感知同场状态（严禁同场面对面还当面递信）
      provider0?.updatePresence(place, here);

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

  Future<void> _handleSend() async {
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

    if (_replyingCorrespondence != null) {
      final target = _replyingCorrespondence!;
      setState(() => _replyingCorrespondence = null);
      provider.addLocalUserReply(text);
      final ok = await provider.api.replyCorrespondence(target.threadId ?? target.id, text);
      if (ok) {
        provider.addLocalNarrative('（信使收下手书，快马折返向「${target.speaker ?? '对方'}」呈递。）');
      } else {
        provider.addLocalNarrative('（回信未送达，稍后可重试。）');
      }
      if (mounted) _refreshPlace();
      _scrollToBottom(force: true);
      _refocusInput();
      return;
    }

    await provider.sendMessage(text);
    if (mounted) _refreshPlace();
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
          // 切回世界：不管之前滚到哪，都回到最新一条
          if (index == 0) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _scrollToBottom(force: true);
              Future<void>.delayed(const Duration(milliseconds: 180), () {
                if (mounted) _scrollToBottom(force: true);
              });
            });
          }
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
                                final homeName = (self['homeName'] ?? '').toString();
                                final locRaw = (self['location'] ?? '').toString();
                                String place = (self['place'] ?? '').toString().trim();
                                if (place.isEmpty || place.contains('house_') || place.contains('__gate') || RegExp(r'^[a-zA-Z0-9_-]+$').hasMatch(place)) {
                                  if (place.contains('__gate') || locRaw.contains('__gate')) {
                                    place = homeName.isNotEmpty ? '$homeName·门外' : '宅院门外';
                                  } else if (place.isEmpty || RegExp(r'^[a-zA-Z0-9_-]+$').hasMatch(place)) {
                                    place = homeName.isNotEmpty ? homeName : '门外';
                                  }
                                }
                                final day = (snap.data?['date'] is Map) ? snap.data!['date'] as Map : const {};
                                final txt = '$place · 第${day['day'] ?? '-'}日 ${day['hour'] ?? '-'}时';
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
            // （出门/家兵/记账/今日看板/我的世界 都已收进输入框左侧的 + 菜单，这里不再重复）
            ListTile(
              leading: const Icon(Icons.videocam_rounded, color: Color(0xFF8B5CF6)),
              title: Text(
                provider.isHusband ? '闺房视讯' : '面对面对聊',
                style: const TextStyle(color: Colors.white),
              ),
              subtitle: Text(
                provider.isHusband ? '与内人红颜面对面' : '音画视讯 · 免打字推演',
                style: const TextStyle(color: Colors.white54, fontSize: 11),
              ),
              onTap: () async {
                Navigator.pop(context);
                await Navigator.push(context, MaterialPageRoute(builder: (_) => const VideoCallScreen()));
                if (mounted) {
                  _jumpToBottom();
                }
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
        backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
        foregroundColor: isDark ? Colors.white : const Color(0xFF0F172A),
        elevation: 0.5,
        titleSpacing: 0,
        centerTitle: true,
        title: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Container(
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
          ),
        ),
        actions: [
          // 外观：点一下切换 日间/夜间/跟随系统，长按打开三选一
          Builder(builder: (ctx) {
            final theme = ctx.watch<ThemeController>();
            final icon = theme.mode == ThemeMode.light
                ? Icons.light_mode_rounded
                : (theme.mode == ThemeMode.dark ? Icons.dark_mode_rounded : Icons.brightness_auto_rounded);
            return IconButton(
              icon: Icon(icon, color: const Color(0xFFA78BFA)),
              tooltip: '外观：${theme.label}',
              onPressed: () {
                final next = theme.mode == ThemeMode.system
                    ? ThemeMode.light
                    : (theme.mode == ThemeMode.light ? ThemeMode.dark : ThemeMode.system);
                theme.setMode(next);
              },
              onLongPress: () => _showThemeSheet(context),
            );
          }),
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
          // 📹 面对面对聊·视频通话
          IconButton(
            icon: const Icon(Icons.videocam_rounded, color: Color(0xFF8B5CF6)),
            tooltip: provider.isHusband ? '发起闺房视频通话' : '发起面对面视讯对聊',
            onPressed: () async {
              HapticFeedback.mediumImpact();
              await Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const VideoCallScreen()),
              );
              if (mounted) {
                _jumpToBottom();
              }
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
                  isDismissible: false,
                      builder: (_) => OutAndAboutSheet(api: provider.api, onChanged: _refreshPlace),
                    ).then((_) => _refreshPlace());
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF1B1E28) : const Color(0xFFF8FAFC),
                      border: Border(
                        bottom: BorderSide(
                          color: isDark ? Colors.white.withValues(alpha: 0.08) : const Color(0xFFE2E8F0),
                          width: 0.8,
                        ),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                      children: [
                        Icon(
                          Icons.place_rounded,
                          size: 15,
                          color: isDark ? const Color(0xFF8B5CF6) : const Color(0xFF7C3AED),
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            _placeName.isEmpty ? '定位中…' : _placeName,
                            style: TextStyle(
                              color: isDark ? Colors.white : const Color(0xFF0F172A),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.2,
                            ),
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
                                    duration: const Duration(seconds: 4),
                                    behavior: SnackBarBehavior.floating,
                                  ));
                                }
                              },
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.home_rounded,
                                    size: 14,
                                    color: isDark ? const Color(0xFF8B5CF6) : const Color(0xFF7C3AED),
                                  ),
                                  const SizedBox(width: 2),
                                  Text(
                                    '回家',
                                    style: TextStyle(
                                      color: isDark ? const Color(0xFF9B8CF6) : const Color(0xFF6D28D9),
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
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
                              style: TextStyle(
                                color: isDark ? const Color(0xFF9B8CF6) : const Color(0xFF6D28D9),
                                fontSize: 11.5,
                                fontWeight: FontWeight.w500,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        if (_worldDay > 0)
                          Text(
                            '第$_worldDay日 $_worldHour时',
                            style: TextStyle(
                              color: isDark ? Colors.white60 : const Color(0xFF334155),
                              fontSize: 11.5,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        const SizedBox(width: 4),
                        Icon(
                          Icons.keyboard_arrow_right_rounded,
                          size: 15,
                          color: isDark ? Colors.white70 : const Color(0xFF475569),
                        ),
                      ],
                        ),
                        // 此处有谁
                        Padding(
                          padding: const EdgeInsets.only(left: 20, top: 2),
                          child: Text(
                            _hereNames.isEmpty
                                ? '此处无人'
                                : '此处：${_hereNames.length <= 4 ? _hereNames.join('、') : '${_hereNames.take(4).join('、')}等${_hereNames.length}人'}',
                            style: TextStyle(
                              color: isDark ? Colors.white60 : const Color(0xFF334155),
                              fontSize: 11.5,
                              fontWeight: FontWeight.w500,
                            ),
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
                              onReplyCorrespondence: (target) {
                                setState(() => _replyingCorrespondence = target);
                                _refocusInput();
                              },
                              onActionCorrespondence: _handleActionCorrespondence,
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

  /// 豆包同款底部：上方横向快捷胶囊栏 + 下方一体化大圆角胶囊输入框
  Widget _buildInputArea(ChatProvider provider) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pillBg = isDark ? const Color(0xFF1C202B) : Colors.white;
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.10)
        : Colors.black.withValues(alpha: 0.08);
    final iconColor = isDark ? Colors.white70 : const Color(0xFF1E293B);

    return Container(
      padding: const EdgeInsets.fromLTRB(12.0, 4.0, 12.0, 10.0),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. 快捷胶囊条（支持长按左右拖动互换位置，自动持久化记住顺序）
          SizedBox(
            height: 38,
            child: Theme(
              data: Theme.of(context).copyWith(
                canvasColor: Colors.transparent,
                shadowColor: Colors.transparent,
              ),
              child: ReorderableListView.builder(
                scrollDirection: Axis.horizontal,
                buildDefaultDragHandles: false,
                itemCount: _capsuleOrder.length,
                onReorder: _onCapsuleReorder,
                itemBuilder: (ctx, index) {
                  final key = _capsuleOrder[index];
                  return ReorderableDelayedDragStartListener(
                    key: ValueKey(key),
                    index: index,
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: _buildCapsuleWidget(key, isDark, provider),
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 6),

          // 2. 同屏提笔回信指示条（若正在回复信函/差事）
          if (_replyingCorrespondence != null)
            Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2A2318) : const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isDark ? const Color(0xFF78350F) : const Color(0xFFFDE68A),
                ),
              ),
              child: Row(
                children: [
                  const Text('✍️ ', style: TextStyle(fontSize: 13)),
                  Expanded(
                    child: Text(
                      '提笔手书回复「${_replyingCorrespondence!.speaker ?? '对方'}」：${_replyingCorrespondence!.displayCleanText.replaceAll('\n', ' ')}',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  InkWell(
                    onTap: () => setState(() => _replyingCorrespondence = null),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.all(2.0),
                      child: Icon(Icons.close_rounded, size: 16, color: isDark ? const Color(0xFFFBBF24) : const Color(0xFFB45309)),
                    ),
                  ),
                ],
              ),
            ),

          // 2. 豆包同款一体化大圆角胶囊输入框（左相机 · 中输入/按住说话 · 右声波与加号/发送）
          AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            constraints: const BoxConstraints(minHeight: 50),
            padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
            decoration: BoxDecoration(
              gradient: (_isVoiceMode && _isHoldingRecord)
                  ? const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFFA855F7)])
                  : null,
              color: (_isVoiceMode && _isHoldingRecord) ? null : pillBg,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: (_isVoiceMode && _isHoldingRecord)
                    ? const Color(0xFF8B5CF6)
                    : borderColor,
                width: 1.0,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.20 : 0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // 胶囊最左侧：相机图标
                InkWell(
                  onTap: _showPhotoSourceSheet,
                  borderRadius: BorderRadius.circular(20),
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Icon(
                      Icons.camera_alt_outlined,
                      color: (_isVoiceMode && _isHoldingRecord) ? Colors.white : iconColor,
                      size: 23,
                    ),
                  ),
                ),
                const SizedBox(width: 4),

                // 胶囊正中间：按住说话 OR 无边框输入框
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
                                      ? Colors.white
                                      : const Color(0xFF8B5CF6),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  _isHoldingRecord ? '松开 发送' : '按住 说话',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: _isHoldingRecord
                                        ? Colors.white
                                        : (isDark ? Colors.white : const Color(0xFF1E293B)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      : TextField(
                          controller: _textController,
                          focusNode: _inputFocus,
                          minLines: 1,
                          maxLines: 4,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _handleSend(),
                          // iOS 上点别处也要能把键盘收回去
                          onTapOutside: (_) => FocusManager.instance.primaryFocus?.unfocus(),
                          style: TextStyle(
                            fontSize: 15.5,
                            color: isDark ? Colors.white : const Color(0xFF1E293B),
                          ),
                          decoration: InputDecoration(
                            hintText: '发消息或按住说话...',
                            hintStyle: TextStyle(
                              fontSize: 15,
                              color: isDark ? Colors.white38 : Colors.grey.shade400,
                            ),
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
                          ),
                        ),
                ),
                const SizedBox(width: 4),

                // 胶囊最右侧：根据是否有输入文字智能切换（无文字显示 [声波] + [⊕]，有文字显示 [↑ 发送]）
                ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _textController,
                  builder: (context, value, _) {
                    final hasText = value.text.trim().isNotEmpty && !_isVoiceMode;
                    if (hasText || provider.isSending) {
                      return GestureDetector(
                        onTap: provider.isSending ? null : _handleSend,
                        child: Container(
                          width: 34,
                          height: 34,
                          margin: const EdgeInsets.only(right: 2),
                          decoration: const BoxDecoration(
                            color: Color(0xFF2563EB),
                            shape: BoxShape.circle,
                          ),
                          child: provider.isSending
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

                    // 空输入状态：完全复刻豆包右侧的 [声波圆钮] + [加号圆钮]
                    final btnFg = (_isVoiceMode && _isHoldingRecord) ? Colors.white : iconColor;
                    return Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // 切换语音 / 键盘圆圈按钮
                        InkWell(
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setState(() {
                              _isVoiceMode = !_isVoiceMode;
                            });
                          },
                          borderRadius: BorderRadius.circular(20),
                          child: Padding(
                            padding: const EdgeInsets.all(6.0),
                            child: Container(
                              width: 26,
                              height: 26,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: btnFg.withValues(alpha: 0.75), width: 1.5),
                              ),
                              child: Icon(
                                _isVoiceMode ? Icons.keyboard_alt_outlined : Icons.graphic_eq_rounded,
                                color: btnFg,
                                size: 15,
                              ),
                            ),
                          ),
                        ),
                        // 豆包同款 + 号圆圈按钮
                        InkWell(
                          onTap: () => _showQuickActionSheet(context, provider),
                          borderRadius: BorderRadius.circular(20),
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(4.0, 6.0, 6.0, 6.0),
                            child: Container(
                              width: 26,
                              height: 26,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: btnFg.withValues(alpha: 0.75), width: 1.5),
                              ),
                              child: Icon(
                                Icons.add_rounded,
                                color: btnFg,
                                size: 17,
                              ),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCapsuleWidget(String key, bool isDark, ChatProvider provider) {
    switch (key) {
      case 'out':
        return _buildTopQuickChip(
          icon: Icons.explore_outlined,
          label: '出门转场',
          hasArrow: true,
          isDark: isDark,
          onTap: () {
            HapticFeedback.lightImpact();
            showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              isDismissible: false,
              builder: (_) => OutAndAboutSheet(api: provider.api, onChanged: _refreshPlace),
            ).then((_) => _refreshPlace());
          },
        );
      case 'today':
        return _buildTopQuickChip(
          icon: Icons.today_outlined,
          label: '今日',
          isDark: isDark,
          onTap: () {
            HapticFeedback.lightImpact();
            showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (_) => DigestSheet(api: provider.api),
            );
          },
        );
      case 'army':
        return _buildTopQuickChip(
          icon: Icons.shield_outlined,
          label: '随身家兵',
          isDark: isDark,
          onTap: () {
            HapticFeedback.lightImpact();
            showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (_) => ArmySheet(
                api: provider.api,
                onChanged: () => setState(() {}),
              ),
            );
          },
        );
      case 'world':
        return _buildTopQuickChip(
          icon: Icons.public_rounded,
          label: '我的世界',
          isDark: isDark,
          onTap: () {
            HapticFeedback.lightImpact();
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => MyWorldScreen(api: provider.api), fullscreenDialog: true),
            );
          },
        );
      case 'roster':
      default:
        return _buildTopQuickChip(
          icon: Icons.favorite_rounded,
          label: '世情好感',
          isDark: isDark,
          onTap: () {
            HapticFeedback.lightImpact();
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => RosterScreen(
                  api: provider.api,
                  onActionMessage: (msg) {
                    _refreshPlace();
                  },
                ),
                fullscreenDialog: true,
              ),
            );
          },
        );
    }
  }

  /// 豆包同款上方轻量快捷胶囊按钮
  Widget _buildTopQuickChip({
    required IconData icon,
    required String label,
    required bool isDark,
    required VoidCallback onTap,
    bool hasArrow = false,
  }) {
    return Material(
      color: isDark ? const Color(0xFF1C202B) : Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          height: 34,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.10)
                  : Colors.black.withValues(alpha: 0.08),
              width: 0.9,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 15,
                color: isDark ? Colors.white70 : const Color(0xFF1E293B),
              ),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.white.withValues(alpha: 0.88) : const Color(0xFF1E293B),
                ),
              ),
              if (hasArrow) ...[
                const SizedBox(width: 2),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 15,
                  color: isDark ? Colors.white38 : Colors.grey.shade400,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showPayDialog(BuildContext context, ChatProvider provider) async {
    final messengerP = ScaffoldMessenger.of(context);
    final ctrlA = TextEditingController();
    final ctrlT = TextEditingController(text: '花销');
    final ok = await showDialog<bool>(
      context: context,
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
  }

  void _showQuickActionSheet(BuildContext context, ChatProvider provider) {
    HapticFeedback.lightImpact();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        final bg = isDark ? const Color(0xFF14161E) : Colors.white;
        final fg = isDark ? Colors.white : const Color(0xFF0F172A);
        final sub = isDark ? Colors.white38 : Colors.black45;
        final itemW = (MediaQuery.of(ctx).size.width - 40 - 36) / 4;

        Widget tile({required IconData icon, required String label, required Color color, required VoidCallback onTap}) {
          return SizedBox(
            width: itemW,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: isDark ? 0.16 : 0.12),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: color.withValues(alpha: 0.35)),
                    ),
                    child: Icon(icon, color: color, size: 24),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: fg, fontSize: 11.5),
                  ),
                ]),
              ),
            ),
          );
        }

        Widget groupTitle(String t) => Padding(
              padding: const EdgeInsets.only(left: 4, top: 4, bottom: 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(t, style: TextStyle(color: sub, fontSize: 11.5)),
              ),
            );

        return Container(
          decoration: BoxDecoration(
            color: bg,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 16, offset: const Offset(0, -4))],
          ),
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
          child: SafeArea(
            top: false,
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Center(
                child: Container(
                  width: 36, height: 4, margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(color: isDark ? Colors.white24 : Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              groupTitle('常用'),
              Wrap(spacing: 12, runSpacing: 10, children: [
                tile(
                  icon: Icons.explore_rounded, label: '转场出门', color: const Color(0xFF8B5CF6),
                  onTap: () {
                    Navigator.pop(ctx);
                    showModalBottomSheet(
                      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
                      builder: (_) => OutAndAboutSheet(api: provider.api, onChanged: _refreshPlace),
                    ).then((_) => _refreshPlace());
                  },
                ),
                tile(
                  icon: Icons.today_rounded, label: '今日看板', color: const Color(0xFFE0B252),
                  onTap: () {
                    Navigator.pop(ctx);
                    showModalBottomSheet(
                      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
                      builder: (_) => DigestSheet(api: provider.api),
                    );
                  },
                ),
                tile(
                  icon: Icons.shield_rounded, label: '随身家兵', color: const Color(0xFF10B981),
                  onTap: () {
                    Navigator.pop(ctx);
                    showModalBottomSheet(
                      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
                      builder: (_) => ArmySheet(api: provider.api, onChanged: () => setState(() {})),
                    );
                  },
                ),
                tile(
                  icon: Icons.public_rounded, label: '我的世界', color: const Color(0xFF38BDF8),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => MyWorldScreen(api: provider.api), fullscreenDialog: true),
                    );
                  },
                ),
                tile(
                  icon: Icons.favorite_rounded, label: '世情好感', color: const Color(0xFFEC4899),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => RosterScreen(
                          api: provider.api,
                          onActionMessage: (msg) {
                            _refreshPlace();
                          },
                        ),
                        fullscreenDialog: true,
                      ),
                    );
                  },
                ),
              ]),
              groupTitle('其它'),
              Wrap(spacing: 12, runSpacing: 10, children: [
                tile(
                  icon: Icons.inventory_2_rounded, label: '随身契据', color: const Color(0xFFE0B252),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showItemsSheet(context, provider);
                  },
                ),
                tile(
                  icon: Icons.payments_rounded, label: '记一笔账', color: const Color(0xFF94A3B8),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showPayDialog(context, provider);
                  },
                ),
                tile(
                  icon: Icons.camera_alt_rounded, label: '拍照端详', color: const Color(0xFFEC4899),
                  onTap: () {
                    Navigator.pop(ctx);
                    _pickAndSendImage(ImageSource.camera);
                  },
                ),
                tile(
                  icon: Icons.videocam_rounded, label: provider.isHusband ? '闺房视讯' : '面对面对聊', color: const Color(0xFFF59E0B),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await Navigator.push(context, MaterialPageRoute(builder: (_) => const VideoCallScreen()));
                  },
                ),
                tile(
                  icon: Icons.contrast_rounded, label: '外观', color: const Color(0xFFA78BFA),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showThemeSheet(context);
                  },
                ),
              ]),
            ]),
          ),
        );
      },
    );
  }


  /// 外观：日间 / 夜间 / 跟随系统
  void _showThemeSheet(BuildContext context) {
    final theme = context.read<ThemeController>();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF12131A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 26),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          const Text('外观模式', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 14),
          for (final m in [ThemeMode.system, ThemeMode.light, ThemeMode.dark])
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                onTap: () async {
                  await theme.setMode(m);
                  if (ctx.mounted) Navigator.pop(ctx);
                },
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                  decoration: BoxDecoration(
                    color: theme.mode == m ? const Color(0xFF8B5CF6).withValues(alpha: 0.18) : const Color(0xFF1A1B25),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: theme.mode == m ? const Color(0xFF8B5CF6) : Colors.white10),
                  ),
                  child: Row(children: [
                    Icon(
                      m == ThemeMode.system ? Icons.brightness_auto_rounded : (m == ThemeMode.light ? Icons.light_mode_rounded : Icons.dark_mode_rounded),
                      size: 18,
                      color: theme.mode == m ? Colors.white : Colors.white54,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      m == ThemeMode.system ? '跟随系统' : (m == ThemeMode.light ? '日间' : '夜间'),
                      style: TextStyle(color: theme.mode == m ? Colors.white : Colors.white70, fontSize: 14),
                    ),
                    const Spacer(),
                    if (theme.mode == m) const Icon(Icons.check_rounded, size: 18, color: Color(0xFF8B5CF6)),
                  ]),
                ),
              ),
            ),
        ]),
      ),
    );
  }

  void _showItemsSheet(BuildContext context, ChatProvider provider) {
    HapticFeedback.selectionClick();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => FutureBuilder<Map<String, dynamic>?>(
        future: provider.api.fetchMyWorld(),
        builder: (ctx, snapshot) {
          final isDark = Theme.of(context).brightness == Brightness.dark;
          final d = snapshot.data ?? const {};
          final items = (d['items'] as List?) ?? const [];

          return Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.65),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF12131A) : Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 36,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 14),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white24 : Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      const Icon(Icons.inventory_2_rounded, size: 20, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 8),
                      Text(
                        '随身物产 · 契纸字据（${items.length}）',
                        style: TextStyle(
                          color: isDark ? Colors.white : const Color(0xFF1E293B),
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, size: 18),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (snapshot.connectionState == ConnectionState.waiting)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 36),
                      child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                    )
                  else if (items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 36),
                      child: Center(
                        child: Text(
                          '随身未携有房契字据或宝物',
                          style: TextStyle(color: isDark ? Colors.white38 : Colors.grey),
                        ),
                      ),
                    )
                  else
                    Flexible(
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: items.length,
                        separatorBuilder: (_, __) => Divider(
                          height: 1,
                          color: isDark ? Colors.white10 : Colors.grey.shade200,
                        ),
                        itemBuilder: (ctx, i) {
                          final item = (items[i] is Map) ? items[i] as Map : {};
                          final name = '${item['name'] ?? '未知物产'}';
                          final kind = '${item['kind'] ?? '契纸'}';
                          final detail = '${item['detail'] ?? item['desc'] ?? ''}';
                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                            leading: Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.description_outlined, color: Color(0xFFF59E0B), size: 20),
                            ),
                            title: Row(
                              children: [
                                Text(name, style: TextStyle(
                                  color: isDark ? Colors.white : const Color(0xFF1E293B),
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w600,
                                )),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(kind, style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 10.5)),
                                ),
                              ],
                            ),
                            subtitle: detail.isNotEmpty ? Text(
                              detail,
                              style: TextStyle(color: isDark ? Colors.white38 : Colors.grey.shade600, fontSize: 12),
                            ) : null,
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
