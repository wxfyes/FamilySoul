import io
p = 'mobile/lib/services/api_client.dart'
s = io.open(p, encoding='utf-8').read()
old = """        '/assistant/chat',
        queryParameters: {'token': config.token.trim()},
        data: {'text': text, 'newSession': newSession},
      );"""
new = """        '/assistant/chat',
        queryParameters: {'token': config.token.trim()},
        data: {
          'text': text,
          'newSession': newSession,
          if (imageBase64 != null) 'imageBase64': imageBase64,
          if (mimeType != null) 'mimeType': mimeType,
        },
      );"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① body 带图')
