import io
p = 'mobile/lib/widgets/register_dialog.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("[...name].every((ch) => functionChars.contains(ch))",
              "name.characters.every((ch) => functionChars.contains(ch))")
io.open(p, 'w', encoding='utf-8').write(s)
print('改用 characters.every')
