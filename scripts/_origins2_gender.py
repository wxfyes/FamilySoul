import io
p = 'mobile/lib/widgets/register_dialog.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("String _originKind = 'scholar';", "String _originKind = 'youngMan';", 1)
old = "                  if (val != null) setState(() => _gender = val);"
new = """                  if (val != null) {
                    setState(() {
                      _gender = val;
                      // 只换年岁称谓，不替他选职业
                      const female = {'girl', 'youngWoman', 'bride', 'matron', 'primeWoman', 'middleWoman', 'elderWoman'};
                      const male = {'boy', 'youngMan', 'primeMan', 'middleMan', 'elderMan'};
                      if (val == 'female' && male.contains(_originKind)) _originKind = 'youngWoman';
                      if (val == 'male' && female.contains(_originKind)) _originKind = 'youngMan';
                    });
                  }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 性别切换时联动年岁称谓')
