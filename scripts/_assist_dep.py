import io
p = 'mobile/lib/views/assistant_view.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""      await _speech.listen(
        localeId: 'zh_CN',
        onResult: (r) {""",
"""      await _speech.listen(
        listenOptions: SpeechListenOptions(localeId: 'zh_CN'),
        onResult: (r) {""", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('修 deprecation')
