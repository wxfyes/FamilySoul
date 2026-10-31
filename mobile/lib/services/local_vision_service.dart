import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// 手机端原生离线视觉识别服务（0 代理、0 网络依赖、0 Gemini 依赖）
/// - iOS：调用系统底层 Apple Vision Framework (VNRecognizeTextRequest + VNClassifyImageRequest + VNDetectFaceLandmarksRequest)
/// - Android：调用原生图像特征与人脸/色调分析
class LocalVisionService {
  LocalVisionService._();
  static final LocalVisionService instance = LocalVisionService._();

  static const MethodChannel _channel = MethodChannel('familysoul/local_vision');

  Future<String> analyzeImage({String? filePath, String? base64Image}) async {
    try {
      final res = await _channel.invokeMethod<String>('analyzeImage', {
        'path': filePath ?? '',
        'base64': base64Image ?? '',
      });
      final clean = (res ?? '').trim();
      if (clean.isNotEmpty) {
        debugPrint('[LocalVision] 👁️ 手机原生离线识图成功: $clean');
      }
      return clean;
    } catch (e) {
      debugPrint('[LocalVision] 原生识图跳过: $e');
      return '';
    }
  }
}
