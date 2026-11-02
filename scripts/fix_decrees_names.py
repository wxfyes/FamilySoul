import io

p = 'mobile/lib/views/my_world_screen.dart'
s = io.open(p, encoding='utf-8-sig').read()

s = s.replace("if ((data['decrees'] as List?)?.isNotEmpty == true) ...[",
              "if ((d['decrees'] as List?)?.isNotEmpty == true) ...[")
s = s.replace("for (final d in (data['decrees'] as List))",
              "for (final dec in (d['decrees'] as List))")
s = s.replace("Text('第${d['day']}日', style: const TextStyle(color: _muted, fontSize: 11.5)),",
              "Text('第${dec['day']}日', style: const TextStyle(color: _muted, fontSize: 11.5)),")
s = s.replace("'「${d['text'] ?? ''}」',",
              "'「${dec['text'] ?? ''}」',")

io.open(p, 'w', encoding='utf-8').write(s)
print('patched names')
