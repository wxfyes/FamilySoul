import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa_onnx;

/// 内置纯离线中文流式语音识别引擎 (Sherpa-ONNX Streaming Zipformer-zh)
/// 专为 Android 打造：零网络、零代理、零 Google 服务依赖，边说边出字
class OfflineAsrService {
  OfflineAsrService._();
  static final OfflineAsrService instance = OfflineAsrService._();

  sherpa_onnx.OnlineRecognizer? _recognizer;
  sherpa_onnx.OnlineStream? _stream;
  final AudioRecorder _recorder = AudioRecorder();
  StreamSubscription<Uint8List>? _audioSub;

  bool _isReady = false;
  bool _isListening = false;
  Completer<bool>? _initCompleter;
  String _currentText = '';
  String _committedText = '';
  int? _leftoverByte;

  bool get isReady => _isReady;
  bool get isListening => _isListening;
  String get currentText => _currentText;

  static const List<String> _assetFiles = [
    'encoder.int8.onnx',
    'decoder.onnx',
    'joiner.int8.onnx',
    'tokens.txt',
  ];

  /// 初始化内置离线中文模型（首次启动自动解压至沙箱目录）
  Future<bool> ensureInitialized() async {
    if (!Platform.isAndroid) return false;
    if (_isReady && _recognizer != null) return true;
    if (_initCompleter != null) return _initCompleter!.future;

    _initCompleter = Completer<bool>();
    try {
      debugPrint('[OfflineASR] 🚀 正在加载 APK 内置中文离线语音模型...');
      final supportDir = await getApplicationSupportDirectory();
      final modelDir = Directory('${supportDir.path}/sherpa_zh_v1');
      if (!modelDir.existsSync()) {
        modelDir.createSync(recursive: true);
      }

      for (final fileName in _assetFiles) {
        final targetFile = File('${modelDir.path}/$fileName');
        if (!targetFile.existsSync() || targetFile.lengthSync() < 1024) {
          final byteData = await rootBundle.load('assets/asr/$fileName');
          final bytes = byteData.buffer.asUint8List(
            byteData.offsetInBytes,
            byteData.lengthInBytes,
          );
          await targetFile.writeAsBytes(bytes, flush: true);
          debugPrint('[OfflineASR] 📦 已释放离线模型组件: $fileName (${(bytes.length / 1024).toStringAsFixed(0)} KB)');
        }
      }

      sherpa_onnx.initBindings();

      final transducer = sherpa_onnx.OnlineTransducerModelConfig(
        encoder: '${modelDir.path}/encoder.int8.onnx',
        decoder: '${modelDir.path}/decoder.onnx',
        joiner: '${modelDir.path}/joiner.int8.onnx',
      );

      final modelConfig = sherpa_onnx.OnlineModelConfig(
        transducer: transducer,
        tokens: '${modelDir.path}/tokens.txt',
        numThreads: 2,
        provider: 'cpu',
        debug: false,
        modelType: 'zipformer',
      );

      final config = sherpa_onnx.OnlineRecognizerConfig(
        model: modelConfig,
        enableEndpoint: true,
        rule1MinTrailingSilence: 3.2,
        rule2MinTrailingSilence: 2.2,
        rule3MinUtteranceLength: 35.0,
      );

      _recognizer = sherpa_onnx.OnlineRecognizer(config);
      _isReady = true;
      debugPrint('[OfflineASR] ✅ 内置中文离线语音引擎就绪！');
      _initCompleter!.complete(true);
      return true;
    } catch (e) {
      debugPrint('[OfflineASR] ❌ 初始化内置离线语音引擎异常: $e');
      _isReady = false;
      _initCompleter!.complete(false);
      _initCompleter = null;
      return false;
    }
  }

  /// 启动流式离线语音识别
  /// [continuous] 为 true 时用于视频通话（自动检测断句 Endpoint 并重置流继续听）
  /// [continuous] 为 false 时用于主界面按住说话（松手时统一结算）
  Future<bool> startListening({
    required void Function(String text, bool isEndpoint) onResult,
    bool continuous = false,
  }) async {
    final ok = await ensureInitialized();
    if (!ok || _recognizer == null) return false;

    await stopListening();

    try {
      _stream = _recognizer!.createStream();
      _currentText = '';
      _committedText = '';
      _leftoverByte = null;
      _isListening = true;

      final pcmStream = await _recorder.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: 16000,
          numChannels: 1,
          autoGain: true,
          echoCancel: true,
          noiseSuppress: true,
        ),
      );

      _audioSub = pcmStream.listen(
        (Uint8List chunk) {
          if (!_isListening || _recognizer == null || _stream == null) return;
          final samples = _pcm16ToFloat32(chunk);
          if (samples.isEmpty) return;

          _stream!.acceptWaveform(samples: samples, sampleRate: 16000);
          while (_recognizer!.isReady(_stream!)) {
            _recognizer!.decode(_stream!);
          }

          final text = _recognizer!.getResult(_stream!).text.trim();
          final endpoint = _recognizer!.isEndpoint(_stream!);

          if (text.isNotEmpty && text != _currentText) {
            _currentText = text;
            final fullText = _committedText.isEmpty ? _currentText : '$_committedText，$_currentText';
            onResult(fullText, false);
          }

          if (continuous && endpoint) {
            if (_currentText.isNotEmpty) {
              _committedText = _committedText.isEmpty ? _currentText : '$_committedText，$_currentText';
            }
            _recognizer!.reset(_stream!);
            _currentText = '';
            if (_committedText.isNotEmpty) {
              onResult(_committedText, true);
            }
          }
        },
        onError: (e) {
          debugPrint('[OfflineASR] 音频流错误: $e');
        },
      );
      return true;
    } catch (e) {
      debugPrint('[OfflineASR] 启动离线监听失败: $e');
      _isListening = false;
      return false;
    }
  }

  /// 停止监听并冲刷最后一个字的识别结果（用于按住说话松手结算）
  Future<String> stopAndFinalize() async {
    _isListening = false;
    try {
      await _audioSub?.cancel();
      _audioSub = null;
      await _recorder.stop();
    } catch (_) {}

    if (_recognizer != null && _stream != null) {
      try {
        // 注入 0.25 秒静音尾音并标记输入结束，确保最后一个字完整解码吐出
        final tailPadding = Float32List(4000);
        _stream!.acceptWaveform(samples: tailPadding, sampleRate: 16000);
        _stream!.inputFinished();
        while (_recognizer!.isReady(_stream!)) {
          _recognizer!.decode(_stream!);
        }
        final finalRes = _recognizer!.getResult(_stream!).text.trim();
        if (finalRes.isNotEmpty) {
          _currentText = finalRes;
        }
      } catch (e) {
        debugPrint('[OfflineASR] 尾部结算异常: $e');
      } finally {
        try {
          _stream?.free();
        } catch (_) {}
        _stream = null;
      }
    }

    final fullOut = _committedText.isEmpty
        ? _currentText.trim()
        : (_currentText.trim().isEmpty ? _committedText : '$_committedText，${_currentText.trim()}');
    _currentText = '';
    _committedText = '';
    return fullOut;
  }

  /// 直接停止监听并释放当前流
  Future<void> stopListening() async {
    _isListening = false;
    try {
      await _audioSub?.cancel();
      _audioSub = null;
      if (await _recorder.isRecording()) {
        await _recorder.stop();
      }
    } catch (_) {}

    try {
      _stream?.free();
    } catch (_) {}
    _stream = null;
    _currentText = '';
    _committedText = '';
    _leftoverByte = null;
  }

  Float32List _pcm16ToFloat32(Uint8List bytes) {
    if (bytes.isEmpty) return Float32List(0);
    Uint8List aligned;
    if (_leftoverByte != null) {
      aligned = Uint8List(bytes.length + 1);
      aligned[0] = _leftoverByte!;
      aligned.setRange(1, aligned.length, bytes);
      _leftoverByte = null;
    } else {
      aligned = bytes;
    }

    if (aligned.length.isOdd) {
      _leftoverByte = aligned.last;
      aligned = Uint8List.sublistView(aligned, 0, aligned.length - 1);
    }

    final numSamples = aligned.length ~/ 2;
    if (numSamples == 0) return Float32List(0);

    final out = Float32List(numSamples);
    final bd = ByteData.sublistView(aligned);
    for (int i = 0; i < numSamples; i++) {
      final s = bd.getInt16(i * 2, Endian.little);
      out[i] = s / 32768.0;
    }
    return out;
  }
}
