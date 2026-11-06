import io
p = 'mobile/lib/widgets/register_dialog.dart'
s = io.open(p, encoding='utf-8').read()
start = s.find("                items: const [")
end = s.find("                ],", start)
if start > 0 and end > 0:
    new = """                items: const [
                  DropdownMenuItem(value: 'girl', child: Text('及笄少女')),
                  DropdownMenuItem(value: 'boy', child: Text('少年郎')),
                  DropdownMenuItem(value: 'youngWoman', child: Text('青年女子')),
                  DropdownMenuItem(value: 'youngMan', child: Text('青年男子')),
                  DropdownMenuItem(value: 'bride', child: Text('新妇')),
                  DropdownMenuItem(value: 'matron', child: Text('少妇')),
                  DropdownMenuItem(value: 'primeWoman', child: Text('当家妇人')),
                  DropdownMenuItem(value: 'primeMan', child: Text('壮年男子')),
                  DropdownMenuItem(value: 'middleWoman', child: Text('中年妇人')),
                  DropdownMenuItem(value: 'middleMan', child: Text('中年男子')),
                  DropdownMenuItem(value: 'elderWoman', child: Text('老妇')),
                  DropdownMenuItem(value: 'elderMan', child: Text('老者')),
"""
    s = s[:start] + new + s[end:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('② 客户端出身改为年岁状态')
