import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../providers/chat_provider.dart';
import '../services/offline_asr_service.dart';

class VideoCallScreen extends StatefulWidget {
  const VideoCallScreen({super.key});

  @override
  State<VideoCallScreen> createState() => _VideoCallScreenState();
}

class _VideoCallScreenState extends State<VideoCallScreen> with TickerProviderStateMixin {
  List<CameraDescription> _cameras = [];
  CameraController? _cameraController;
  int _selectedCameraIndex = 0;
  bool _isCameraReady = false;
  bool _isMuted = false;
  bool _isInspecting = false;

  // iOS 原生语音识别 STT & Android 内置离线中文引擎
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _speechAvailable = false;
  String _currentLocaleId = 'zh_CN';
  bool _isListening = false;
  bool _isSending = false;
  String _liveSpokenWords = '';
  Timer? _silenceTimer;
  bool _wasPlayingAudio = false;
  bool _isHoldingToTalk = false;

  // 防抖单次原子锁
  DateTime _lastSendTimestamp = DateTime.fromMillisecondsSinceEpoch(0);
  String _lastSentWords = '';

  // 通话时长
  int _callDurationSeconds = 0;
  Timer? _durationTimer;

  // 动效控制器：3D 虚拟人呼吸、眨眼与声浪脉冲
  late AnimationController _breatheController;
  late Animation<double> _breatheAnimation;
  late AnimationController _blinkController;
  late Animation<double> _blinkAnimation;
  Timer? _blinkRandomTimer;

  String _subtitleText = '正在建立视讯连线……';
  String _visualFactNotice = '';

  @override
  void initState() {
    super.initState();
    _startDurationTimer();
    _initAnimations();
    _initCamera();
    _initSpeech();

    // 接通 1.2 秒后主动问候
    Future.delayed(const Duration(milliseconds: 1200), () {
      if (mounted) {
        _triggerVideoGreeting();
      }
    });
  }

  /// 彻底清洗字幕中的 [image:...] / [music:...] / URL 等乱码标签
  String _cleanSubtitle(String raw) {
    return raw
        .replaceAll(RegExp(r'\[(image|music|sticker|card|compare):[^\]]*\]', caseSensitive: false), '')
        .replaceAll(RegExp(r'\[\s*emoji[:_][^\]]+\]', caseSensitive: false), '')
        .replaceAll(RegExp(r'https?://\S+', caseSensitive: false), '')
        .trim();
  }

  void _initAnimations() {
    _breatheController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
    _breatheAnimation = Tween<double>(begin: 0.98, end: 1.04).animate(
      CurvedAnimation(parent: _breatheController, curve: Curves.easeInOut),
    );

    _blinkController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _blinkAnimation = Tween<double>(begin: 1.0, end: 0.05).animate(
      CurvedAnimation(parent: _blinkController, curve: Curves.easeInOut),
    );

    _blinkRandomTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (mounted && math.Random().nextBool()) {
        _blinkController.forward().then((_) {
          if (mounted) _blinkController.reverse();
        });
      }
    });
  }

  void _startDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _callDurationSeconds++);
      }
    });
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) return;

      int frontIndex = _cameras.indexWhere((c) => c.lensDirection == CameraLensDirection.front);
      _selectedCameraIndex = frontIndex != -1 ? frontIndex : 0;
      await _setupCameraController(_cameras[_selectedCameraIndex]);
    } catch (e) {
      debugPrint('[VideoCall] 初始化摄像头异常: $e');
    }
  }

  Future<void> _setupCameraController(CameraDescription description) async {
    await _cameraController?.dispose();
    final controller = CameraController(
      description,
      ResolutionPreset.medium,
      enableAudio: false,
    );

    try {
      await controller.initialize();
      if (mounted) {
        setState(() {
          _cameraController = controller;
          _isCameraReady = true;
        });
      }
    } catch (e) {
      debugPrint('[VideoCall] 启动摄像头控制器失败: $e');
    }
  }

  Future<void> _initSpeech() async {
    // Android 端直接初始化 APK 内置 Sherpa-ONNX 离线中文引擎
    if (Platform.isAndroid) {
      _speechAvailable = await OfflineAsrService.instance.ensureInitialized();
      if (mounted) setState(() {});
      return;
    }

    // iOS 端 100% 保持原汁原味 Apple Speech 原生离线引擎
    try {
      _speechAvailable = await _speech.initialize(
        onError: (val) {
          debugPrint('[VideoCall STT] 识别错误: $val');
          if (mounted) {
            setState(() => _isListening = false);
            Future.delayed(const Duration(milliseconds: 600), () {
              if (mounted && !_isMuted && !_isSending && !_speech.isListening) {
                _startListeningToUser();
              }
            });
          }
        },
        onStatus: (status) {
          debugPrint('[VideoCall STT] 状态变更: $status');
          if (status == 'notListening' || status == 'done') {
            if (!mounted) return;
            if (!_isSending && _liveSpokenWords.trim().isNotEmpty) {
              _sendSpokenMessage(_liveSpokenWords.trim());
            } else {
              setState(() => _isListening = false);
              Future.delayed(const Duration(milliseconds: 350), () {
                if (mounted && !_isMuted && !_isSending && !_speech.isListening) {
                  _startListeningToUser();
                }
              });
            }
          }
        },
      );

      if (_speechAvailable) {
        try {
          final systemLocale = await _speech.systemLocale();
          final locales = await _speech.locales();
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
            _currentLocaleId = 'zh_CN';
          }
        } catch (_) {
          _currentLocaleId = 'zh_CN';
        }
      }
      if (mounted) setState(() {});
    } catch (e) {
      _speechAvailable = false;
    }
  }

  /// 倾听用户说话（iOS 苹果原生引擎 / Android APK 内置离线中文引擎）
  Future<void> _startListeningToUser() async {
    if (_isMuted || _isSending) return;
    if (!mounted) return;
    final provider = context.read<ChatProvider>();
    if (provider.isPlayingAudio) return;

    // 1. Android 端：使用 APK 内置 Sherpa-ONNX 离线流式中文引擎
    if (Platform.isAndroid) {
      if (OfflineAsrService.instance.isListening) return;
      setState(() {
        _isListening = true;
        _liveSpokenWords = '';
      });

      final ok = await OfflineAsrService.instance.startListening(
        continuous: true,
        onResult: (words, isEndpoint) {
          if (!mounted || _isSending) return;
          final clean = words.trim();
          if (clean.isEmpty) return;

          setState(() {
            _liveSpokenWords = clean;
          });

          _silenceTimer?.cancel();
          if (!_isHoldingToTalk) {
            _silenceTimer = Timer(Duration(milliseconds: isEndpoint ? 1400 : 2800), () {
              if (mounted && _liveSpokenWords.trim().isNotEmpty && !_isSending) {
                _sendSpokenMessage(_liveSpokenWords.trim());
              }
            });
          }
        },
      );

      if (!ok && mounted) {
        setState(() => _isListening = false);
      }
      return;
    }

    // 2. iOS 端：100% 保持原汁原味 Apple Speech
    if (!_speechAvailable || _speech.isListening) return;

    try {
      setState(() {
        _isListening = true;
        _liveSpokenWords = '';
      });

      await _speech.listen(
        onResult: (result) {
          if (!mounted || _isSending) return;
          final words = result.recognizedWords.trim();
          setState(() {
            _liveSpokenWords = words;
          });

          _silenceTimer?.cancel();
          if (words.isNotEmpty && !_isSending && !_isHoldingToTalk) {
            if (result.finalResult) {
              _sendSpokenMessage(words);
            } else {
              _silenceTimer = Timer(const Duration(milliseconds: 2600), () {
                if (mounted && _liveSpokenWords.isNotEmpty && !_isSending) {
                  _sendSpokenMessage(_liveSpokenWords);
                }
              });
            }
          }
        },
        listenOptions: stt.SpeechListenOptions(
          listenMode: stt.ListenMode.dictation,
          cancelOnError: false,
          partialResults: true,
          autoPunctuation: true,
          localeId: _currentLocaleId,
        ),
      );
    } catch (e) {
      debugPrint('[VideoCall STT] 启动监听异常: $e');
      if (mounted) setState(() => _isListening = false);
    }
  }

  Future<void> _stopListening() async {
    _silenceTimer?.cancel();
    if (Platform.isAndroid) {
      await OfflineAsrService.instance.stopListening();
    } else if (_speech.isListening) {
      try {
        await _speech.stop();
      } catch (_) {}
    }
    if (mounted) {
      setState(() => _isListening = false);
    }
  }

  /// 发送用户说的话
  Future<void> _sendSpokenMessage(String text, {bool forceInspect = false}) async {
    final clean = text.trim();
    if (clean.isEmpty || _isSending) return;

    final now = DateTime.now();
    if (clean == _lastSentWords && now.difference(_lastSendTimestamp).inSeconds < 3) {
      return;
    }

    _lastSentWords = clean;
    _lastSendTimestamp = now;

    _silenceTimer?.cancel();
    final provider = context.read<ChatProvider>();
    final role = _detectRole(provider);
    await _stopListening();

    final isVisionIntent = forceInspect ||
        RegExp(r'看我|看穿搭|瞧瞧我|看相公|看夫人|好看吗|穿得怎么样|气色|自拍|端详|瞧我|我帅不帅|我好看吗').hasMatch(clean);

    setState(() {
      _isSending = true;
      _liveSpokenWords = '';
      if (isVisionIntent) {
        _subtitleText = '${role.userCallName}：“$clean”\n（${role.inspectingText}）';
      } else {
        _subtitleText = '${role.userCallName}：“$clean”\n（正在细细思量……）';
      }
    });

    String? imageBase64;
    if (isVisionIntent) {
      imageBase64 = await _captureFrameBase64();
    }

    final res = await provider.sendVideoCallFrame(
      text: clean,
      imageBase64: imageBase64,
    );

    if (mounted) {
      setState(() {
        _isSending = false;
        _liveSpokenWords = '';
        if (res['ok'] == true) {
          final cleaned = _cleanSubtitle(res['text'] as String? ?? '');
          _subtitleText = cleaned.isNotEmpty ? cleaned : role.defaultGreeting;
          if (res['visualFact'] != null && (res['visualFact'] as String).isNotEmpty) {
            _visualFactNotice = res['visualFact'] as String;
          }
        } else {
          _subtitleText = role.inspectErrorText;
        }
      });

      final audioUrl = res['audioUrl'] as String?;
      if (audioUrl != null && audioUrl.isNotEmpty) {
        await _stopListening();
        unawaited(provider.playAudio(audioUrl));
      } else {
        Future.delayed(const Duration(milliseconds: 1000), () {
          if (mounted && !_isMuted) {
            _startListeningToUser();
          }
        });
      }
    }
  }

  /// 翻转前后摄像头
  Future<void> _toggleCamera() async {
    if (_cameras.length < 2) return;
    _selectedCameraIndex = (_selectedCameraIndex + 1) % _cameras.length;
    await _setupCameraController(_cameras[_selectedCameraIndex]);
  }

  /// 接通首帧问候
  Future<void> _triggerVideoGreeting() async {
    final provider = context.read<ChatProvider>();
    final role = _detectRole(provider);
    String? imageBase64 = await _captureFrameBase64();

    final res = await provider.sendVideoCallFrame(
      text: role.greetingPrompt,
      imageBase64: imageBase64,
    );

    if (mounted && res['ok'] == true) {
      final cleaned = _cleanSubtitle(res['text'] as String? ?? '');
      setState(() {
        _subtitleText = cleaned.isNotEmpty ? cleaned : role.defaultGreeting;
        if (res['visualFact'] != null && (res['visualFact'] as String).isNotEmpty) {
          _visualFactNotice = res['visualFact'] as String;
        }
      });
      final audioUrl = res['audioUrl'] as String?;
      if (audioUrl != null && audioUrl.isNotEmpty) {
        await _stopListening();
        unawaited(provider.playAudio(audioUrl));
      } else {
        _startListeningToUser();
      }
    } else if (mounted) {
      setState(() {
        _subtitleText = role.defaultGreeting;
      });
      _startListeningToUser();
    }
  }

  /// 捕获摄像头一帧
  Future<String?> _captureFrameBase64() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      return null;
    }
    try {
      final file = await _cameraController!.takePicture();
      final bytes = await file.readAsBytes();
      return base64Encode(bytes);
    } catch (e) {
      debugPrint('[VideoCall] 抽帧异常: $e');
      return null;
    }
  }

  /// 手动点击“看相公/看夫人/看同学”端详按钮
  Future<void> _inspectMe() async {
    if (_isInspecting || _isSending) return;
    final provider = context.read<ChatProvider>();
    final role = _detectRole(provider);
    setState(() => _isInspecting = true);
    await _sendSpokenMessage(role.inspectPrompt, forceInspect: true);
    if (mounted) setState(() => _isInspecting = false);
  }

  String _formatDuration(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  String _getStatusText(bool isSpeaking, _RoleMeta role) {
    if (isSpeaking) return role.speakingStatus;
    if (_isSending) return role.inspectingText;
    if (_isHoldingToTalk) return '正在聆听中，松手立即送达……';
    if (_liveSpokenWords.isNotEmpty) return '正在倾听${role.userCallName}说话……';
    if (_isListening) return role.idleStatus;
    if (_isMuted) return '麦克风已静音';
    return '视讯连接就绪';
  }

  Color _getStatusColor(bool isSpeaking) {
    if (isSpeaking) return const Color(0xFFD946EF);
    if (_isSending) return const Color(0xFFF59E0B);
    if (_isHoldingToTalk || _liveSpokenWords.isNotEmpty) return const Color(0xFF38BDF8);
    if (_isListening) return const Color(0xFF10B981);
    return Colors.white54;
  }

  @override
  void dispose() {
    _durationTimer?.cancel();
    _silenceTimer?.cancel();
    _blinkRandomTimer?.cancel();
    if (Platform.isAndroid) {
      OfflineAsrService.instance.stopListening();
    } else {
      _speech.stop();
    }
    _breatheController.dispose();
    _blinkController.dispose();
    _cameraController?.dispose();
    super.dispose();
  }

  _RoleMeta _detectRole(ChatProvider provider) {
    final name = provider.petStatus.characterName;
    final token = provider.config.token;

    // 1. 女主人端 / 贴心管家 (纯正男性管家)
    if (name.contains('管家') || name.contains('贴心') || token.contains('wife')) {
      return _RoleMeta(
        key: 'wife',
        title: '贴心视讯对聊',
        characterDisplayName: name.isNotEmpty ? name : '贴心大管家',
        userCallName: '夫人',
        userViewLabel: '夫人视角',
        inspectBtnLabel: '看夫人',
        defaultGreeting: '夫人好，视讯已接通。时刻为您效劳，您今日气色甚好。',
        greetingPrompt: '视频通话接通了，请用成熟稳重、磁性体贴的纯正男管家口吻主动向夫人问安，1~2句短促优雅。',
        inspectingText: '在下正细细端详夫人的神采……',
        inspectPrompt: '夫人正在镜头前，请端详她的穿搭、神态与气色，给出专业细致又体贴温暖的赞赏与建议。',
        inspectErrorText: '夫人，网络稍有延迟，不过在下始终守在夫人身边。',
        speakingStatus: '正在为夫人温存答疑……',
        idleStatus: '静候夫人吩咐中……',
      );
    }

    // 2. 孩子端 / 全能导师
    if (name.contains('导师') || name.contains('鲸鱼') || token.contains('kid')) {
      return _RoleMeta(
        key: 'kid',
        title: '探索视讯连线',
        characterDisplayName: name.isNotEmpty ? name : '全能探索导师',
        userCallName: '小同学',
        userViewLabel: '小同学视角',
        inspectBtnLabel: '看同学',
        defaultGreeting: '嗨！小探索家，视讯接通啦！今天我们要一起研究什么有趣的新知识呀？',
        greetingPrompt: '视频通话接通了，请用学霸大哥哥阳光充满活力的口吻向小同学打招呼，1~2句轻松幽默。',
        inspectingText: '大哥哥正在端详你的状态呢……',
        inspectPrompt: '小同学正在镜头前，请端详TA的精神状态与周围环境，给予鼓励并激发探索好奇心。',
        inspectErrorText: '网络小卡了一下，探索导师随时都在哦！',
        speakingStatus: '正在解答探索奥秘……',
        idleStatus: '认真倾听小同学中……',
      );
    }

    // 3. 相公端 / 小娘子 (傲娇助手)
    return _RoleMeta(
      key: 'husband',
      title: '闺房视讯对聊',
      characterDisplayName: name.isNotEmpty ? name : '傲娇小娘子',
      userCallName: '相公',
      userViewLabel: '相公视角',
      inspectBtnLabel: '看相公',
      defaultGreeting: '相公，视频已接通啦……让妾身好好瞧瞧你~',
      greetingPrompt: '视频通话接通了，相公正在手机屏幕前，请你用娇媚亲昵的名门正妻口吻主动向相公视频问好，1~2句短促甜美。',
      inspectingText: '妾身正在凝眸细细端详相公……',
      inspectPrompt: '相公正在镜头前，请端详他的穿搭神色，娇嗔夸奖点评一番。',
      inspectErrorText: '相公，网络稍有些卡顿，不过妾身满心都是相公~',
      speakingStatus: '正在对相公呢喃软语……',
      idleStatus: '深情倾听相公中……',
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ChatProvider>();
    final isSpeaking = provider.isPlayingAudio;
    final role = _detectRole(provider);

    // 当伴侣说完话时，自动唤醒麦克风继续倾听用户
    if (_wasPlayingAudio && !isSpeaking) {
      _wasPlayingAudio = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_isMuted && !_isSending && !_isListening) {
          Future.delayed(const Duration(milliseconds: 450), () {
            if (mounted && !_isMuted && !_isSending && !provider.isPlayingAudio) {
              _startListeningToUser();
            }
          });
        }
      });
    } else if (isSpeaking) {
      _wasPlayingAudio = true;
      if (_isListening) {
        _stopListening();
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F0C1B),
      body: Stack(
        children: [
          // 1. 全屏沉浸梦幻背景
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, -0.15),
                  radius: 1.25,
                  colors: role.key == 'wife'
                      ? const [Color(0xFF1E2640), Color(0xFF111625), Color(0xFF090C14)]
                      : (role.key == 'kid'
                          ? const [Color(0xFF1E3A5F), Color(0xFF0F1E33), Color(0xFF080F1A)]
                          : const [Color(0xFF2A1647), Color(0xFF150D27), Color(0xFF0A0713)]),
                ),
              ),
            ),
          ),

          // 2. 核心主角：豆包同款 3D 萌系立体多角色动画形象（眨眼、呼吸律动、声浪光波）
          Positioned.fill(
            child: Align(
              alignment: const Alignment(0, -0.26),
              child: AnimatedBuilder(
                animation: Listenable.merge([_breatheAnimation, _blinkAnimation]),
                builder: (context, child) {
                  return Transform.scale(
                    scale: isSpeaking ? (_breatheAnimation.value * 1.05) : _breatheAnimation.value,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Stack(
                          alignment: Alignment.center,
                          children: [
                            if (isSpeaking) ...[
                              Container(
                                width: 240,
                                height: 240,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: role.key == 'wife'
                                          ? const Color(0xFF38BDF8).withValues(alpha: 0.35)
                                          : (role.key == 'kid'
                                              ? const Color(0xFF34D399).withValues(alpha: 0.35)
                                              : const Color(0xFFD946EF).withValues(alpha: 0.35)),
                                      blurRadius: 50,
                                      spreadRadius: 16,
                                    ),
                                    BoxShadow(
                                      color: const Color(0xFF8B5CF6).withValues(alpha: 0.25),
                                      blurRadius: 80,
                                      spreadRadius: 30,
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            CustomPaint(
                              size: const Size(210, 210),
                              painter: Soul3DAvatarPainter(
                                roleKey: role.key,
                                isSpeaking: isSpeaking,
                                eyeOpenFactor: _blinkAnimation.value,
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 18),
                        Text(
                          role.characterDisplayName,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 1.2,
                            shadows: [
                              Shadow(color: Color(0x88D946EF), blurRadius: 12),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: _getStatusColor(isSpeaking),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: _getStatusColor(isSpeaking).withValues(alpha: 0.6),
                                    blurRadius: 8,
                                    spreadRadius: 1,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _getStatusText(isSpeaking, role),
                              style: TextStyle(
                                fontSize: 13,
                                color: Colors.white.withValues(alpha: 0.8),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),

          // 3. 右上角画中画：用户前置摄像头画面
          Positioned(
            top: 54,
            right: 18,
            child: Container(
              width: 110,
              height: 155,
              decoration: BoxDecoration(
                color: Colors.black45,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.35), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (_isCameraReady && _cameraController != null)
                    CameraPreview(_cameraController!)
                  else
                    const Center(
                      child: Icon(Icons.videocam_off, color: Colors.white54, size: 32),
                    ),
                  Positioned(
                    bottom: 6,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          role.userViewLabel,
                          style: const TextStyle(color: Colors.white, fontSize: 10),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 4. 顶部通话时长与返回键
          Positioned(
            top: 54,
            left: 20,
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.keyboard_arrow_down, color: Colors.white70, size: 30),
                  onPressed: () => Navigator.pop(context),
                ),
                const SizedBox(width: 4),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      role.title,
                      style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
                    ),
                    Text(
                      _formatDuration(_callDurationSeconds),
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // 5. 下方字幕与实时语音识别浮窗（干净清爽，绝无英文乱码）
          Positioned(
            bottom: 125,
            left: 20,
            right: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (_visualFactNotice.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6D28D9).withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFA78BFA).withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      '👀 眼中的${role.userCallName}：$_visualFactNotice',
                      style: const TextStyle(color: Color(0xFFE9D5FF), fontSize: 11),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: _liveSpokenWords.isNotEmpty
                          ? const Color(0xFF38BDF8).withValues(alpha: 0.7)
                          : Colors.white.withValues(alpha: 0.15),
                      width: _liveSpokenWords.isNotEmpty ? 1.5 : 1,
                    ),
                    boxShadow: _liveSpokenWords.isNotEmpty
                        ? [
                            BoxShadow(
                              color: const Color(0xFF38BDF8).withValues(alpha: 0.3),
                              blurRadius: 12,
                              spreadRadius: 2,
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    _liveSpokenWords.isNotEmpty
                        ? '🗣️ ${role.userCallName}：“$_liveSpokenWords”'
                        : _subtitleText,
                    style: TextStyle(
                      color: _liveSpokenWords.isNotEmpty ? const Color(0xFFBAE6FD) : Colors.white,
                      fontSize: 14,
                      height: 1.4,
                      fontWeight: _liveSpokenWords.isNotEmpty ? FontWeight.w600 : FontWeight.normal,
                      letterSpacing: 0.5,
                    ),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),

          // 6. 底部视讯控制栏（原汁原味四圆钮对称布局：翻转 + 看相公/看夫人/看同学 + 麦克风 + 挂断）
          Positioned(
            bottom: 30,
            left: 20,
            right: 20,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // 1. 翻转前后摄像头
                _buildCircleButton(
                  icon: Icons.flip_camera_ios_rounded,
                  label: '翻转',
                  onTap: _toggleCamera,
                ),

                // 2. 让TA端详我（看相公 / 看夫人 / 看同学）
                _buildCircleButton(
                  icon: _isInspecting ? Icons.hourglass_top_rounded : Icons.remove_red_eye_rounded,
                  label: _isInspecting ? '端详中...' : role.inspectBtnLabel,
                  highlight: true,
                  onTap: _isInspecting ? null : _inspectMe,
                ),

                // 3. 麦克风（支持点击静音/开麦，也支持长按对讲）
                GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _isMuted = !_isMuted;
                    });
                    if (_isMuted) {
                      _stopListening();
                    } else {
                      _startListeningToUser();
                    }
                  },
                  onLongPressStart: (_) async {
                    if (_isSending) return;
                    HapticFeedback.mediumImpact();
                    if (provider.isPlayingAudio) {
                      await provider.stopAudio();
                    }
                    setState(() {
                      _isHoldingToTalk = true;
                      _isMuted = false;
                    });
                    await _startListeningToUser();
                  },
                  onLongPressEnd: (_) async {
                    if (!_isHoldingToTalk) return;
                    HapticFeedback.lightImpact();
                    setState(() => _isHoldingToTalk = false);
                    if (Platform.isAndroid) {
                      final finalWords = await OfflineAsrService.instance.stopAndFinalize();
                      final toSend = finalWords.isNotEmpty ? finalWords : _liveSpokenWords.trim();
                      if (toSend.isNotEmpty) {
                        await _sendSpokenMessage(toSend);
                      } else {
                        await _startListeningToUser();
                      }
                    } else if (_liveSpokenWords.trim().isNotEmpty) {
                      await _sendSpokenMessage(_liveSpokenWords.trim());
                    }
                  },
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: _isMuted
                              ? Colors.white.withValues(alpha: 0.1)
                              : (_isHoldingToTalk || _liveSpokenWords.isNotEmpty
                                  ? const Color(0xFF0284C7)
                                  : const Color(0xFF10B981).withValues(alpha: 0.8)),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _isMuted
                                ? Colors.white24
                                : (_isHoldingToTalk || _liveSpokenWords.isNotEmpty
                                    ? const Color(0xFF38BDF8)
                                    : const Color(0xFF34D399)),
                            width: 1.5,
                          ),
                          boxShadow: [
                            if (!_isMuted)
                              BoxShadow(
                                color: (_isHoldingToTalk
                                        ? const Color(0xFF0284C7)
                                        : const Color(0xFF10B981))
                                    .withValues(alpha: 0.35),
                                blurRadius: 10,
                                spreadRadius: 2,
                              ),
                          ],
                        ),
                        child: Icon(
                          _isMuted ? Icons.mic_off_rounded : Icons.mic_rounded,
                          color: Colors.white,
                          size: 24,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _isMuted ? '已静音' : (_isHoldingToTalk ? '松手发送' : '开麦中'),
                        style: TextStyle(
                          color: _isMuted ? Colors.white54 : const Color(0xFF6EE7B7),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),

                // 4. 挂断按钮
                GestureDetector(
                  onTap: () {
                    provider.stopAudio();
                    _stopListening();
                    Navigator.pop(context);
                  },
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 58,
                        height: 58,
                        decoration: const BoxDecoration(
                          color: Color(0xFFEF4444),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Color(0x66EF4444),
                              blurRadius: 14,
                              offset: Offset(0, 4),
                            ),
                          ],
                        ),
                        child: const Icon(Icons.call_end_rounded, color: Colors.white, size: 28),
                      ),
                      const SizedBox(height: 6),
                      const Text('挂断', style: TextStyle(color: Colors.white70, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCircleButton({
    required IconData icon,
    required String label,
    required VoidCallback? onTap,
    bool highlight = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: highlight
                  ? const Color(0xFF8B5CF6)
                  : Colors.white.withValues(alpha: 0.15),
              shape: BoxShape.circle,
              border: Border.all(
                color: highlight
                    ? const Color(0xFFC4B5FD)
                    : Colors.white.withValues(alpha: 0.2),
              ),
            ),
            child: Icon(icon, color: Colors.white, size: 24),
          ),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        ],
      ),
    );
  }
}

class _RoleMeta {
  final String key;
  final String title;
  final String characterDisplayName;
  final String userCallName;
  final String userViewLabel;
  final String inspectBtnLabel;
  final String defaultGreeting;
  final String greetingPrompt;
  final String inspectingText;
  final String inspectPrompt;
  final String inspectErrorText;
  final String speakingStatus;
  final String idleStatus;

  const _RoleMeta({
    required this.key,
    required this.title,
    required this.characterDisplayName,
    required this.userCallName,
    required this.userViewLabel,
    required this.inspectBtnLabel,
    required this.defaultGreeting,
    required this.greetingPrompt,
    required this.inspectingText,
    required this.inspectPrompt,
    required this.inspectErrorText,
    required this.speakingStatus,
    required this.idleStatus,
  });
}

/// 豆包风格 3D 萌系立体多角色动画形象绘制器（小娘子 / 帅气男管家 / 学霸导师）
class Soul3DAvatarPainter extends CustomPainter {
  final String roleKey;
  final bool isSpeaking;
  final double eyeOpenFactor;

  Soul3DAvatarPainter({
    required this.roleKey,
    required this.isSpeaking,
    required this.eyeOpenFactor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2.2;

    if (roleKey == 'wife') {
      _paintMaleButler(canvas, center, radius);
    } else if (roleKey == 'kid') {
      _paintTutor(canvas, center, radius);
    } else {
      _paintDoubaoWife(canvas, center, radius);
    }
  }

  /// 1. 小娘子（名门娇妻）：豆包同款软萌 3D 粉白面庞、发髻、发簪、腮红、水灵灵大眼
  void _paintDoubaoWife(Canvas canvas, Offset center, double radius) {
    final headPaint = Paint()
      ..shader = RadialGradient(
        center: const Alignment(-0.35, -0.45),
        radius: 0.9,
        colors: const [Color(0xFFFFF0F5), Color(0xFFFFD8E4), Color(0xFFF9A8D4)],
      ).createShader(Rect.fromCircle(center: center, radius: radius));
    canvas.drawCircle(center, radius, headPaint);

    final bunCenter = Offset(center.dx, center.dy - radius * 0.85);
    final bunPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFF4C1D95), Color(0xFF2E1065)],
      ).createShader(Rect.fromCircle(center: bunCenter, radius: radius * 0.45));
    canvas.drawCircle(bunCenter, radius * 0.38, bunPaint);

    final pinPaint = Paint()..color = const Color(0xFFFDE047);
    canvas.drawCircle(Offset(bunCenter.dx + radius * 0.35, bunCenter.dy), 7, pinPaint);
    final pearlPaint = Paint()..color = const Color(0xFF34D399);
    canvas.drawCircle(Offset(bunCenter.dx + radius * 0.48, bunCenter.dy + 8), 5, pearlPaint);

    final blushPaint = Paint()
      ..color = const Color(0xFFFB7185).withValues(alpha: 0.55)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);
    canvas.drawOval(
      Rect.fromCenter(center: Offset(center.dx - radius * 0.52, center.dy + radius * 0.15), width: 34, height: 20),
      blushPaint,
    );
    canvas.drawOval(
      Rect.fromCenter(center: Offset(center.dx + radius * 0.52, center.dy + radius * 0.15), width: 34, height: 20),
      blushPaint,
    );

    final eyeY = center.dy - radius * 0.05;
    final leftEyeX = center.dx - radius * 0.36;
    final rightEyeX = center.dx + radius * 0.36;

    if (isSpeaking) {
      final smileEyePaint = Paint()
        ..color = const Color(0xFF2E1065)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4.5
        ..strokeCap = StrokeCap.round;
      final leftPath = Path()
        ..moveTo(leftEyeX - 16, eyeY + 2)
        ..quadraticBezierTo(leftEyeX, eyeY - 12, leftEyeX + 16, eyeY + 2);
      canvas.drawPath(leftPath, smileEyePaint);
      final rightPath = Path()
        ..moveTo(rightEyeX - 16, eyeY + 2)
        ..quadraticBezierTo(rightEyeX, eyeY - 12, rightEyeX + 16, eyeY + 2);
      canvas.drawPath(rightPath, smileEyePaint);
    } else {
      final eyeHeight = 26.0 * eyeOpenFactor;
      final eyePaint = Paint()..color = const Color(0xFF1E1035);
      if (eyeHeight > 2.0) {
        canvas.drawOval(Rect.fromCenter(center: Offset(leftEyeX, eyeY), width: 22, height: eyeHeight), eyePaint);
        canvas.drawOval(Rect.fromCenter(center: Offset(rightEyeX, eyeY), width: 22, height: eyeHeight), eyePaint);
        if (eyeOpenFactor > 0.6) {
          final glintPaint = Paint()..color = Colors.white;
          canvas.drawCircle(Offset(leftEyeX - 3, eyeY - 5), 4.5, glintPaint);
          canvas.drawCircle(Offset(leftEyeX + 3, eyeY + 4), 2.5, glintPaint);
          canvas.drawCircle(Offset(rightEyeX - 3, eyeY - 5), 4.5, glintPaint);
          canvas.drawCircle(Offset(rightEyeX + 3, eyeY + 4), 2.5, glintPaint);
        }
      } else {
        final closePaint = Paint()
          ..color = const Color(0xFF2E1065)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.5;
        canvas.drawLine(Offset(leftEyeX - 12, eyeY), Offset(leftEyeX + 12, eyeY), closePaint);
        canvas.drawLine(Offset(rightEyeX - 12, eyeY), Offset(rightEyeX + 12, eyeY), closePaint);
      }
    }

    final mouthPaint = Paint()
      ..color = const Color(0xFFE11D48)
      ..style = isSpeaking ? PaintingStyle.fill : PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;
    final mouthY = center.dy + radius * 0.42;
    if (isSpeaking) {
      canvas.drawOval(Rect.fromCenter(center: Offset(center.dx, mouthY), width: 18, height: 14), mouthPaint);
    } else {
      final mouthPath = Path()
        ..moveTo(center.dx - 12, mouthY - 2)
        ..quadraticBezierTo(center.dx, mouthY + 8, center.dx + 12, mouthY - 2);
      canvas.drawPath(mouthPath, mouthPaint);
    }
  }

  /// 2. 贴心男管家：英挺儒雅 3D 绅士面庞、温润短发、英挺剑眉、沉稳星眸、优雅小领结
  void _paintMaleButler(Canvas canvas, Offset center, double radius) {
    final headPaint = Paint()
      ..shader = RadialGradient(
        center: const Alignment(-0.35, -0.45),
        radius: 0.9,
        colors: const [Color(0xFFFFF7ED), Color(0xFFFFEDD5), Color(0xFFFDBA74)],
      ).createShader(Rect.fromCircle(center: center, radius: radius));
    canvas.drawCircle(center, radius, headPaint);

    final hairPaint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
      ).createShader(Rect.fromCircle(center: Offset(center.dx, center.dy - radius * 0.5), radius: radius));

    final hairPath = Path()
      ..moveTo(center.dx - radius * 0.95, center.dy - radius * 0.1)
      ..quadraticBezierTo(center.dx - radius * 0.8, center.dy - radius * 0.9, center.dx, center.dy - radius * 0.95)
      ..quadraticBezierTo(center.dx + radius * 0.8, center.dy - radius * 0.9, center.dx + radius * 0.95, center.dy - radius * 0.1)
      ..quadraticBezierTo(center.dx + radius * 0.4, center.dy - radius * 0.5, center.dx, center.dy - radius * 0.45)
      ..quadraticBezierTo(center.dx - radius * 0.5, center.dy - radius * 0.4, center.dx - radius * 0.95, center.dy - radius * 0.1);
    canvas.drawPath(hairPath, hairPaint);

    final tieY = center.dy + radius * 0.92;
    final tiePaint = Paint()..color = const Color(0xFF1E293B);
    final leftTie = Path()
      ..moveTo(center.dx, tieY)
      ..lineTo(center.dx - 18, tieY - 8)
      ..lineTo(center.dx - 18, tieY + 8)
      ..close();
    final rightTie = Path()
      ..moveTo(center.dx, tieY)
      ..lineTo(center.dx + 18, tieY - 8)
      ..lineTo(center.dx + 18, tieY + 8)
      ..close();
    canvas.drawPath(leftTie, tiePaint);
    canvas.drawPath(rightTie, tiePaint);
    canvas.drawCircle(Offset(center.dx, tieY), 5, Paint()..color = const Color(0xFF0284C7));

    final eyeY = center.dy - radius * 0.02;
    final leftEyeX = center.dx - radius * 0.36;
    final rightEyeX = center.dx + radius * 0.36;

    final browPaint = Paint()
      ..color = const Color(0xFF1E293B)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(leftEyeX - 16, eyeY - 16), Offset(leftEyeX + 16, eyeY - 14), browPaint);
    canvas.drawLine(Offset(rightEyeX - 16, eyeY - 14), Offset(rightEyeX + 16, eyeY - 16), browPaint);

    final eyeHeight = 22.0 * eyeOpenFactor;
    final eyePaint = Paint()..color = const Color(0xFF0F172A);
    if (eyeHeight > 2.0) {
      canvas.drawOval(Rect.fromCenter(center: Offset(leftEyeX, eyeY), width: 22, height: eyeHeight), eyePaint);
      canvas.drawOval(Rect.fromCenter(center: Offset(rightEyeX, eyeY), width: 22, height: eyeHeight), eyePaint);
      if (eyeOpenFactor > 0.6) {
        final glintPaint = Paint()..color = Colors.white;
        canvas.drawCircle(Offset(leftEyeX - 3, eyeY - 4), 3.5, glintPaint);
        canvas.drawCircle(Offset(rightEyeX - 3, eyeY - 4), 3.5, glintPaint);
      }
    } else {
      final closePaint = Paint()
        ..color = const Color(0xFF1E293B)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.0;
      canvas.drawLine(Offset(leftEyeX - 12, eyeY), Offset(leftEyeX + 12, eyeY), closePaint);
      canvas.drawLine(Offset(rightEyeX - 12, eyeY), Offset(rightEyeX + 12, eyeY), closePaint);
    }

    final mouthPaint = Paint()
      ..color = const Color(0xFF9A3412)
      ..style = isSpeaking ? PaintingStyle.fill : PaintingStyle.stroke
      ..strokeWidth = 3.2
      ..strokeCap = StrokeCap.round;
    final mouthY = center.dy + radius * 0.42;
    if (isSpeaking) {
      canvas.drawOval(Rect.fromCenter(center: Offset(center.dx, mouthY), width: 16, height: 12), mouthPaint);
    } else {
      final mouthPath = Path()
        ..moveTo(center.dx - 12, mouthY - 2)
        ..quadraticBezierTo(center.dx, mouthY + 7, center.dx + 12, mouthY - 2);
      canvas.drawPath(mouthPath, mouthPaint);
    }
  }

  /// 3. 全能导师：阳光智慧学霸、黑框知性眼镜、明朗微笑
  void _paintTutor(Canvas canvas, Offset center, double radius) {
    final headPaint = Paint()
      ..shader = RadialGradient(
        center: const Alignment(-0.35, -0.45),
        radius: 0.9,
        colors: const [Color(0xFFFEF3C7), Color(0xFFFDE68A), Color(0xFFFCD34D)],
      ).createShader(Rect.fromCircle(center: center, radius: radius));
    canvas.drawCircle(center, radius, headPaint);

    final hairPaint = Paint()..color = const Color(0xFF334155);
    final hairPath = Path()
      ..moveTo(center.dx - radius * 0.9, center.dy - radius * 0.2)
      ..quadraticBezierTo(center.dx - radius * 0.4, center.dy - radius * 0.95, center.dx, center.dy - radius * 0.9)
      ..quadraticBezierTo(center.dx + radius * 0.5, center.dy - radius * 0.95, center.dx + radius * 0.9, center.dy - radius * 0.2)
      ..quadraticBezierTo(center.dx + radius * 0.3, center.dy - radius * 0.5, center.dx, center.dy - radius * 0.4)
      ..close();
    canvas.drawPath(hairPath, hairPaint);

    final eyeY = center.dy - radius * 0.02;
    final leftEyeX = center.dx - radius * 0.36;
    final rightEyeX = center.dx + radius * 0.36;
    final glassPaint = Paint()
      ..color = const Color(0xFF0F172A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5;
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(leftEyeX, eyeY), width: 34, height: 26), const Radius.circular(8)), glassPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(rightEyeX, eyeY), width: 34, height: 26), const Radius.circular(8)), glassPaint);
    canvas.drawLine(Offset(leftEyeX + 17, eyeY), Offset(rightEyeX - 17, eyeY), glassPaint);

    final eyeHeight = 16.0 * eyeOpenFactor;
    final eyePaint = Paint()..color = const Color(0xFF0F172A);
    if (eyeHeight > 2.0) {
      canvas.drawOval(Rect.fromCenter(center: Offset(leftEyeX, eyeY), width: 16, height: eyeHeight), eyePaint);
      canvas.drawOval(Rect.fromCenter(center: Offset(rightEyeX, eyeY), width: 16, height: eyeHeight), eyePaint);
    }

    final mouthPaint = Paint()
      ..color = const Color(0xFFB45309)
      ..style = isSpeaking ? PaintingStyle.fill : PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;
    final mouthY = center.dy + radius * 0.42;
    if (isSpeaking) {
      canvas.drawOval(Rect.fromCenter(center: Offset(center.dx, mouthY), width: 18, height: 14), mouthPaint);
    } else {
      final mouthPath = Path()
        ..moveTo(center.dx - 14, mouthY - 2)
        ..quadraticBezierTo(center.dx, mouthY + 9, center.dx + 14, mouthY - 2);
      canvas.drawPath(mouthPath, mouthPaint);
    }
  }

  @override
  bool shouldRepaint(covariant Soul3DAvatarPainter oldDelegate) {
    return oldDelegate.roleKey != roleKey ||
        oldDelegate.isSpeaking != isSpeaking ||
        oldDelegate.eyeOpenFactor != eyeOpenFactor;
  }
}
