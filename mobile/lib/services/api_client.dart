import 'dart:async';
import 'package:dio/dio.dart';
import '../models/server_config.dart';
import '../models/chat_message.dart';
import '../models/pet_status.dart';

class SurfCoreApiClient {
  ServerConfig config;
  late Dio _dio;

  SurfCoreApiClient(this.config) {
    _initDio();
  }

  void updateConfig(ServerConfig newConfig) {
    config = newConfig;
    _initDio();
  }

  void _initDio() {
    _dio = Dio(
      BaseOptions(
        baseUrl: config.apiPrefix,
        // 连接（握手）要快失败：手机掉一下网不该干等 60 秒
        connectTimeout: const Duration(seconds: 8),
        // 但「等模型开口」要够久：正文 + 记账员两次调用
        receiveTimeout: const Duration(seconds: 120),
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-pet-token': config.token.trim(),
          // 关键护栏穿透：后端以 Host 头作为回环准入校验，设置 127.0.0.1 允许外部客户端安全通信
          'Host': '127.0.0.1:${config.port}',
        },
      ),
    );
  }

  /// 我的世界：只看自己那一份（时辰/家底/待办/线索/主线）
  Future<Map<String, dynamic>?> fetchMyWorld() async {
    try {
      final res = await _dio.get('/api/me', queryParameters: {'token': config.token.trim()});
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        return res.data as Map<String, dynamic>;
      }
    } catch (_) {
      /* 交由界面显示重试 */
    }
    return null;
  }

  /// 检查服务连通性与健康状态
  Future<bool> checkHealth() async {
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        final res = await _dio.get('/health', queryParameters: {'token': config.token.trim()});
        if (res.statusCode == 200 && res.data != null && res.data['ok'] == true) return true;
      } catch (_) {
        /* 再试一次 */
      }
      if (attempt == 0) await Future.delayed(const Duration(milliseconds: 500));
    }
    return false;
  }

  /// 获取实时角色人设与当前作息状态
  Future<PetStatus> fetchStatus() async {
    try {
      final res = await _dio.get('/status');
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        return PetStatus.fromJson(res.data as Map<String, dynamic>);
      }
    } catch (e) {
      // 容错返回离线状态
    }
    return PetStatus(online: false);
  }

  /// 发送聊天消息（连接失败自动重试，避免手机掉一下网就整条消息失败）
  Future<ChatMessage> sendMessage(String text, {String modality = 'text'}) async {
    Response? response;
    Object? lastError;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        response = await _dio.post(
          '/chat',
          data: {
            'text': text,
            'modality': modality,
          },
        );
        lastError = null;
        break;
      } on DioException catch (e) {
        lastError = e;
        final retriable = e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.connectionError ||
            e.type == DioExceptionType.receiveTimeout;
        if (!retriable || attempt == 2) rethrow;
        await Future.delayed(Duration(milliseconds: 600 * (attempt + 1)));
      }
    }
    if (response == null) {
      throw lastError ?? Exception('网络连接失败，请检查手机与路由器是否在同一网络');
    }

    if (response.statusCode == 200 && response.data != null) {
      final data = response.data as Map<String, dynamic>;
      if (data['ok'] == true && data['reply'] != null) {
        final reply = data['reply'] as Map<String, dynamic>;
        final replyText = reply['text'] as String? ?? '';
        final audioKey = reply['audio']?['key'] as String?;
        String? audioUrl;
        if (audioKey != null && audioKey.isNotEmpty) {
          audioUrl = '${config.apiPrefix}/audio/$audioKey.wav?token=${Uri.encodeComponent(config.token.trim())}';
        }

        return ChatMessage(
          id: reply['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString(),
          text: replyText,
          isUser: false,
          timestamp: DateTime.now(),
          modality: reply['modality'] as String? ?? 'text',
          audioUrl: audioUrl,
        );
      } else {
        throw Exception(data['error'] ?? '回复失败');
      }
    } else {
      throw Exception('网络响应异常: ${response.statusCode}');
    }
  }

  /// 发送视频视讯消息（携带摄像头截帧画面，并支持语音录音直传或文字）
  Future<Map<String, dynamic>> sendVideoChat({
    String? text,
    String? audioBase64,
    String? mimeType,
    String? imageBase64,
    String modality = 'voice',
  }) async {
    final response = await _dio.post(
      '/video-chat',
      data: {
        if (text != null && text.isNotEmpty) 'text': text,
        if (audioBase64 != null && audioBase64.isNotEmpty) 'audioBase64': audioBase64,
        if (mimeType != null && mimeType.isNotEmpty) 'mimeType': mimeType,
        if (imageBase64 != null && imageBase64.isNotEmpty) 'imageBase64': imageBase64,
        'modality': modality,
      },
    );

    if (response.statusCode == 200 && response.data != null) {
      final data = response.data as Map<String, dynamic>;
      if (data['ok'] == true && data['reply'] != null) {
        final reply = data['reply'] as Map<String, dynamic>;
        final replyText = reply['text'] as String? ?? '';
        final audioKey = reply['audio']?['key'] as String?;
        String? audioUrl;
        if (audioKey != null && audioKey.isNotEmpty) {
          audioUrl = '${config.apiPrefix}/audio/$audioKey.wav?token=${Uri.encodeComponent(config.token.trim())}';
        }
        return {
          'ok': true,
          'text': replyText,
          'userText': data['userText'] ?? '',
          'audioUrl': audioUrl,
          'visualFact': data['visualFact'] ?? '',
        };
      }
      throw Exception(data['error'] ?? '视讯通话处理失败');
    }
    throw Exception('视讯服务响应异常: ${response.statusCode}');
  }

  /// 拉取历史消息
  Future<List<ChatMessage>> fetchHistory({int limit = 50}) async {
    try {
      final res = await _dio.get('/history', queryParameters: {'limit': limit});
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        final data = res.data as Map<String, dynamic>;
        final list = data['history'] as List<dynamic>? ?? [];
        return list.map((item) {
          final m = item as Map<String, dynamic>;
          final isUser = m['role'] == 'user';
          final audioKey = m['audioKey'] as String?;
          String? audioUrl;
          if (audioKey != null && audioKey.isNotEmpty) {
            audioUrl = '${config.apiPrefix}/audio/$audioKey.wav?token=${Uri.encodeComponent(config.token.trim())}';
          }
          return ChatMessage(
            id: m['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString(),
            text: m['text'] as String? ?? '',
            isUser: isUser,
            timestamp: m['time'] != null
                ? DateTime.fromMillisecondsSinceEpoch(m['time'] as int)
                : DateTime.now(),
            modality: m['modality'] as String? ?? 'text',
            audioUrl: audioUrl,
          );
        }).toList();
      }
    } catch (_) {}
    return [];
  }

  /// 拉取全家共享的头像表
  Future<Map<String, dynamic>?> fetchAvatars() async {
    try {
      final res = await _dio.get('/avatars');
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        return res.data as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  /// 上传某角色的头像（base64，全家共享）
  Future<Map<String, dynamic>?> uploadAvatar({
    required String speaker,
    required String imageBase64,
  }) async {
    try {
      final res = await _dio.post(
        '/avatar',
        data: {'speaker': speaker, 'imageBase64': imageBase64},
        options: Options(
          sendTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
        ),
      );
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        return res.data as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  /// 长轮询获取事件（AI 主动搭话、心情变化等）
  Future<Map<String, dynamic>?> pollEvents({int? since, int waitMs = 25000}) async {
    try {
      final res = await _dio.get(
        '/events',
        queryParameters: {
          if (since != null) 'since': since,
          'wait': waitMs,
          'client': 'mobile_app',
        },
        options: Options(receiveTimeout: Duration(milliseconds: waitMs + 10000)),
      );
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        return res.data as Map<String, dynamic>;
      }
    } catch (_) {
      // 轮询超时或断开属于预期，上层自动重试
    }
    return null;
  }

  /// 获取小主机上的作息守护配置
  Future<Map<String, dynamic>?> fetchRoutineConfig() async {
    try {
      final res = await _dio.get('/routine');
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        final data = res.data as Map<String, dynamic>;
        if (data['ok'] == true && data['routine'] is Map<String, dynamic>) {
          return data['routine'] as Map<String, dynamic>;
        }
      }
    } catch (_) {}
    return null;
  }

  /// 保存/同步作息守护配置至小主机
  Future<bool> updateRoutineConfig(Map<String, dynamic> routineJson) async {
    try {
      final res = await _dio.post('/routine', data: routineJson);
      return res.statusCode == 200 && res.data != null && res.data['ok'] == true;
    } catch (_) {
      return false;
    }
  }

  /// 语音直传对话（豆包模式：手机录音直传，中枢智能转录）
  Future<Map<String, dynamic>> sendVoiceChat({
    required String audioBase64,
    String modality = 'voice',
    String mimeType = 'audio/aac',
  }) async {
    try {
      final res = await _dio.post(
        '/voice-chat',
        data: {
          'audioBase64': audioBase64,
          'modality': modality,
          'mimeType': mimeType,
        },
      );
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        return res.data as Map<String, dynamic>;
      }
      return {'ok': false, 'error': '服务端返回异常'};
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }
}
