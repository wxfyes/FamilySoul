import io
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
old = """  Future<String?> askAssistant(String text, {bool newSession = false}) async {"""
new = """  Future<String?> askAssistant(String text, {bool newSession = false, String? imageBase64, String? mimeType}) async {"""
if old in s and 'String? imageBase64' not in s.split('askAssistant')[1][:120]:
    s = s.replace(old, new, 1)
    # body 里带上图
    s = s.replace("""        '/assistant/chat',
        data: {'text': text, 'newSession': newSession},""",
"""        '/assistant/chat',
        data: {
          'text': text,
          'newSession': newSession,
          if (imageBase64 != null) 'imageBase64': imageBase64,
          if (mimeType != null) 'mimeType': mimeType,
        },""", 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 客户端 askAssistant 支持图')
