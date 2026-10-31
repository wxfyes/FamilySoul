import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../providers/chat_provider.dart';

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

  // 语音识别 STT (iOS / 已装引擎系统原生自动监听)
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _speechAvailable = false;
  String _currentLocaleId = 'zh_CN';
  bool _isListening = false;
  bool _isSending = false;
  String _liveSpokenWords = '';
  Timer? _silenceTimer;

  // 音频录制器 (Android 兜底：纯麦克风直传对讲)
  final AudioRecorder _audioRecorder = AudioRecorder();
  bool _isHoldingRecord = false;
  String? _recordTempPath;
  DateTime _recordStartTime = DateTime.now();

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

    // 接通 1.2 秒后角色主动问候
    Future.delayed(const Duration(milliseconds: 1200), () {
      if (mounted) {
        _triggerVideoGreeting();
      }
    });
  }

  void _initAnimations() {
    // 1. 身体起伏呼吸律动
    _breatheController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
    _breatheAnimation = Tween<double>(begin: 0.98, end: 1.04).animate(
      CurvedAnimation(parent: _breatheController, curve: Curves.easeInOut),
    );

    // 2. 灵动眨眼动画
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
    try {
      _speechAvailable = await _speech.initialize(
        onError: (val) {
          debugPrint('[VideoCall STT] 识别错误: $val');
          if (mounted) setState(() => _isListening = false);
        },
        onStatus: (status) {
          debugPrint('[VideoCall STT] 状态变更: $status');
          if (status == 'notListening' || status == 'done') {
            if (mounted && !_isSending && _liveSpokenWords.trim().isNotEmpty) {
              _sendSpokenMessage(_liveSpokenWords.trim());
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

  /// 倾听用户说话（iOS 原生自动循环倾听）
  Future<void> _startListening() async {
    if (!_speechAvailable || _isMuted || _isSending) return;
    if (!mounted) return;
    final provider = context.read<ChatProvider>();
    if (provider.isPlayingAudio || _speech.isListening) return;

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
          if (words.isNotEmpty && !_isSending) {
            if (result.finalResult) {
              _sendSpokenMessage(words);
            } else {
              _silenceTimer = Timer(const Duration(milliseconds: 1600), () {
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
    if (_speech.isListening) {
      try {
        await _speech.stop();
      } catch (_) {}
    }
    if (mounted) {
      setState(() => _isListening = false);
    }
  }

  /// 通话刚接通时的主动问候
  Future<void> _triggerVideoGreeting() async {
    final provider = context.read<ChatProvider>();
    final role = _detectRole(provider);
    String? imageBase64 = await _captureFrameBase64();

    final res = await provider.sendVideoCallFrame(
      text: role.greetingPrompt,
      imageBase64: imageBase64,
    );

    if (mounted && res['ok'] == true) {
      setState(() {
        _subtitleText = res['text'] as String? ?? role.defaultGreeting;
        if (res['visualFact'] != null && (res['visualFact'] as String).isNotEmpty) {
          _visualFactNotice = res['visualFact'] as String;
        }
      });
      final audioUrl = res['audioUrl'] as String?;
      if (audioUrl != null && audioUrl.isNotEmpty) {
        unawaited(provider.playAudio(audioUrl));
      }
    } else if (mounted) {
      setState(() {
        _subtitleText = role.defaultGreeting;
      });
    }

    // iOS 端接听问候播放完后自动开启麦克风倾听
    if (Platform.isIOS && _speechAvailable) {
      Future.delayed(const Duration(seconds: 4), () {
        if (mounted) _startListening();
      });
    }
  }

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

  /// 发送用户语音文字（STT 路径）
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
        RegExp(r'看我|看穿搭|瞧瞧我|看相公|看夫人|好看吗|穿得怎么样|气色|自拍|端详|瞧我|帅不帅|好看吗').hasMatch(clean);

    setState(() {
      _isSending = true;
      _liveSpokenWords = '';
      _subtitleText = '正在倾听并思考……';
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
          _subtitleText = res['text'] as String? ?? '';
          if (res['visualFact'] != null && (res['visualFact'] as String).isNotEmpty) {
            _visualFactNotice = res['visualFact'] as String;
          }
        } else {
          _subtitleText = role.inspectErrorText;
        }
      });

      final audioUrl = res['audioUrl'] as String?;
      if (audioUrl != null && audioUrl.isNotEmpty) {
        unawaited(provider.playAudio(audioUrl));
      }
    }
  }

  /// Android / 通用对讲：按住录音切片并直传
  Future<void> _onStartHoldToTalk() async {
    HapticFeedback.mediumImpact();
    final provider = context.read<ChatProvider>();
    if (provider.isPlayingAudio) {
      await provider.stopAudio();
    }
    await _stopListening();

    try {
      final tempDir = await getTemporaryDirectory();
      _recordTempPath = '${tempDir.path}/vcall_${DateTime.now().millisecondsSinceEpoch}.m4a';
      _recordStartTime = DateTime.now();

      await _audioRecorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc, sampleRate: 16000, bitRate: 32000),
        path: _recordTempPath!,
      );

      setState(() {
        _isHoldingRecord = true;
        _subtitleText = '松开即可发送给伴侣……';
      });
    } catch (e) {
      debugPrint('[VideoCall] 启动录音对讲失败: $e');
    }
  }

  Future<void> _onStopHoldToTalk() async {
    if (!_isHoldingRecord) return;
    HapticFeedback.lightImpact();
    setState(() => _isHoldingRecord = false);

    try {
      final path = await _audioRecorder.stop();
      final duration = DateTime.now().difference(_recordStartTime);
      if (duration.inMilliseconds < 450) {
        setState(() => _subtitleText = '说话时间太短');
        return;
      }

      if (path != null && File(path).existsSync()) {
        final bytes = await File(path).readAsBytes();
        final base64Audio = base64Encode(bytes);
        String? imageBase64 = await _captureFrameBase64();

        setState(() {
          _isSending = true;
          _subtitleText = '正在转写并思考……';
        });

        if (!mounted) return;
        final provider = context.read<ChatProvider>();
        final role = _detectRole(provider);

        // 调用语音直传接口
        final res = await provider.sendVoiceChatToVideo(
          audioBase64: base64Audio,
          imageBase64: imageBase64,
        );

        if (mounted) {
          setState(() {
            _isSending = false;
            if (res['ok'] == true) {
              _subtitleText = res['text'] as String? ?? '';
              if (res['visualFact'] != null && (res['visualFact'] as String).isNotEmpty) {
                _visualFactNotice = res['visualFact'] as String;
              }
            } else {
              _subtitleText = role.inspectErrorText;
            }
          });

          final audioUrl = res['audioUrl'] as String?;
          if (audioUrl != null && audioUrl.isNotEmpty) {
            unawaited(provider.playAudio(audioUrl));
          }
        }
      }
    } catch (e) {
      debugPrint('[VideoCall] 对讲传输异常: $e');
      if (mounted) setState(() => _isSending = false);
    }
  }

  /// 点击“让TA端详我”
  Future<void> _inspectMe() async {
    if (_isInspecting) return;
    final provider = context.read<ChatProvider>();
    final role = _detectRole(provider);

    setState(() {
      _isInspecting = true;
      _subtitleText = role.inspectingText;
    });

    String? imageBase64 = await _captureFrameBase64();
    final res = await provider.sendVideoCallFrame(
      text: role.inspectPrompt,
      imageBase64: imageBase64,
    );

    if (mounted) {
      setState(() {
        _isInspecting = false;
        if (res['ok'] == true) {
          _subtitleText = res['text'] as String? ?? '';
          if (res['visualFact'] != null && (res['visualFact'] as String).isNotEmpty) {
            _visualFactNotice = res['visualFact'] as String;
          }
        } else {
          _subtitleText = role.inspectErrorText;
        }
      });

      final audioUrl = res['audioUrl'] as String?;
      if (audioUrl != null && audioUrl.isNotEmpty) {
        unawaited(provider.playAudio(audioUrl));
      }
    }
  }

  Future<void> _toggleCamera() async {
    if (_cameras.length < 2) return;
    _selectedCameraIndex = (_selectedCameraIndex + 1) % _cameras.length;
    await _setupCameraController(_cameras[_selectedCameraIndex]);
  }

  String _formatDuration(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  void dispose() {
    _durationTimer?.cancel();
    _blinkRandomTimer?.cancel();
    _silenceTimer?.cancel();
    _speech.stop();
    _audioRecorder.dispose();
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
        userViewLabel: '夫人视角',
        inspectBtnLabel: '让管家端详我',
        defaultGreeting: '夫人好，视讯已接通。时刻为您效劳，您今日气色甚好。',
        greetingPrompt: '视频通话接通了，请用成熟稳重、磁性体贴的纯正男管家口吻主动向夫人问安，1~2句短促优雅。',
        inspectingText: '在下正细细端详夫人的神采与气色……',
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
        userViewLabel: '小同学视角',
        inspectBtnLabel: '让导师看看我',
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
      userViewLabel: '相公视角',
      inspectBtnLabel: '让娘子端详我',
      defaultGreeting: '相公，视频已接通啦……让妾身好好瞧瞧你~',
      greetingPrompt: '视频通话接通了，相公正在手机屏幕前看着你，请你用娇媚亲昵的名门正妻口吻主动向相公视频问好，1~2句短促甜美。',
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

    return Scaffold(
      backgroundColor: const Color(0xFF13111C),
      body: Stack(
        children: [
          // 1. 全屏沉浸式渐变背景
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, -0.2),
                  radius: 1.2,
                  colors: role.key == 'wife'
                      ? const [Color(0xFF1E2640), Color(0xFF111625), Color(0xFF090C14)]
                      : (role.key == 'kid'
                          ? const [Color(0xFF1E3A5F), Color(0xFF0F1E33), Color(0xFF080F1A)]
                          : const [Color(0xFF2E1A47), Color(0xFF161026), Color(0xFF0C0914)]),
                ),
              ),
              child: Center(
                child: AnimatedBuilder(
                  animation: Listenable.merge([_breatheAnimation, _blinkAnimation]),
                  builder: (context, child) {
                    return Transform.scale(
                      scale: isSpeaking ? (_breatheAnimation.value * 1.05) : _breatheAnimation.value,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // 2. 核心主角：3D 萌系立体虚拟人形象（呼吸、眨眼与声浪光波）
                          Stack(
                            alignment: Alignment.center,
                            children: [
                              if (isSpeaking) ...[
                                Container(
                                  width: 250,
                                  height: 250,
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

                              // 3D 粘土软萌立体虚拟人面部与形象
                              CustomPaint(
                                size: const Size(220, 220),
                                painter: Soul3DAvatarPainter(
                                  roleKey: role.key,
                                  isSpeaking: isSpeaking,
                                  eyeOpenFactor: _blinkAnimation.value,
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 22),
                          // 角色专属姓名
                          Text(
                            role.characterDisplayName,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 1.2,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: Color(0xFF10B981),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                isSpeaking ? role.speakingStatus : role.idleStatus,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.white.withValues(alpha: 0.75),
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
          ),

          // 3. 右上角画中画：用户前置摄像头实时画面
          Positioned(
            top: 54,
            right: 18,
            child: Container(
              width: 110,
              height: 155,
              decoration: BoxDecoration(
                color: Colors.black45,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.3), width: 1.5),
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
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 4. 顶部通话时长与专属标题
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

          // 5. 下方字幕与视觉感知事实浮窗
          Positioned(
            bottom: 130,
            left: 20,
            right: 20,
            child: Column(
              children: [
                if (_visualFactNotice.isNotEmpty) ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF8B5CF6).withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.35)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.visibility_rounded, color: Color(0xFFC084FC), size: 16),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            '端详感知：$_visualFactNotice',
                            style: const TextStyle(color: Color(0xFFE9D5FF), fontSize: 12),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // 对答实时字幕
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                  ),
                  child: Text(
                    _isHoldingRecord ? '正在按住说话中……松开立即发送' : _subtitleText,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _isHoldingRecord ? const Color(0xFFA78BFA) : Colors.white,
                      fontSize: 14.5,
                      height: 1.4,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 6. 底部控制栏
          Positioned(
            bottom: 30,
            left: 16,
            right: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // 1. 翻转前后摄像头
                _buildCircleButton(
                  icon: Icons.flip_camera_ios_rounded,
                  color: Colors.white24,
                  onTap: _toggleCamera,
                ),

                // 2. 核心按钮：让TA端详我（抽帧看穿搭气色）
                GestureDetector(
                  onTap: _inspectMe,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: role.key == 'wife'
                            ? const [Color(0xFF0284C7), Color(0xFF0EA5E9)]
                            : (role.key == 'kid'
                                ? const [Color(0xFF059669), Color(0xFF10B981)]
                                : const [Color(0xFFD946EF), Color(0xFF8B5CF6)]),
                      ),
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF8B5CF6).withValues(alpha: 0.4),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        _isInspecting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Icon(Icons.face_retouching_natural_rounded, color: Colors.white, size: 18),
                        const SizedBox(width: 6),
                        Text(
                          _isInspecting ? '正在端详……' : role.inspectBtnLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 3. 核心对讲：按住说话（彻底根治安卓无法听见我说话的问题）
                GestureDetector(
                  onLongPressStart: (_) => _onStartHoldToTalk(),
                  onLongPressEnd: (_) => _onStopHoldToTalk(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                    decoration: BoxDecoration(
                      color: _isHoldingRecord ? const Color(0xFFE11D48) : const Color(0xFF8B5CF6),
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: (_isHoldingRecord ? const Color(0xFFE11D48) : const Color(0xFF8B5CF6)).withValues(alpha: 0.4),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _isHoldingRecord ? Icons.record_voice_over_rounded : Icons.mic_rounded,
                          color: Colors.white,
                          size: 18,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _isHoldingRecord ? '松开发送' : '按住说话',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 4. 挂断通话
                _buildCircleButton(
                  icon: Icons.call_end_rounded,
                  color: const Color(0xFFEF4444),
                  onTap: () => Navigator.pop(context),
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
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(28),
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.white, size: 22),
      ),
    );
  }
}

class _RoleMeta {
  final String key;
  final String title;
  final String characterDisplayName;
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
