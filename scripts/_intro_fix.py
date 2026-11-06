import io
p = 'mobile/lib/widgets/register_dialog.dart'
lines = io.open(p, encoding='utf-8').read().split('\n')
# 去掉 intro 前的 @override，给 build 补上
for i, l in enumerate(lines):
    if l.strip() == 'Widget _buildIntro(bool isDark) {' and lines[i-1].strip() == '@override':
        lines[i-1] = ''
        break
for i, l in enumerate(lines):
    if l.startswith('  Widget build(BuildContext context) {'):
        lines.insert(i, '  @override')
        break
io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('修正 @override')
