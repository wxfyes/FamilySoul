import io
p = 'mobile/lib/widgets/register_dialog.dart'
s = io.open(p, encoding='utf-8').read()
old = """    if (name.isEmpty || name.length < 2 || name.length > 4) {
      setState(() => _errorMessage = '姓名须为 2~4 个汉字');
      return;
    }"""
new = """    if (name.isEmpty || name.length < 2 || name.length > 4) {
      setState(() => _errorMessage = '姓名须为 2~4 个汉字');
      return;
    }
    const functionChars = '只会那个上来什么不是就可以已经的着了和与我你他她它们这没有在到把被让给对从向为因所但而或且如若虽然很太更最都也还又再才';
    if ([...name].every((ch) => functionChars.contains(ch))) {
      setState(() => _errorMessage = '此名不似人名，请取一个有姓氏或雅号的名字');
      return;
    }"""
if old in s and 'functionChars' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('② 客户端同步规则')
