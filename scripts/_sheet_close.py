import io
p = 'mobile/lib/views/out_and_about_sheet.dart'
s = io.open(p, encoding='utf-8').read()
# 面板右上角加关闭，避免只能靠点外面关
old = """                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    onPressed: _load,
                    tooltip: '刷新',
                  ),"""
new = """                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    onPressed: _load,
                    tooltip: '刷新',
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18),
                    onPressed: () => Navigator.pop(context),
                    tooltip: '关闭',
                  ),"""
if old in s and '关闭' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 面板加关闭按钮')

# 打开面板时：点外面不再关闭（只能按关闭或下滑）
p2 = 'mobile/lib/views/chat_screen.dart'
t = io.open(p2, encoding='utf-8').read()
import re
count = 0
def repl(m):
    global count
    count += 1
    return m.group(0).replace("backgroundColor: Colors.transparent,", "backgroundColor: Colors.transparent,\n                  isDismissible: false,")
t2 = re.sub(r"showModalBottomSheet\(\s*\n\s*context: context,\s*\n\s*isScrollControlled: true,\s*\n\s*backgroundColor: Colors.transparent,\s*\n\s*builder: \(_\) => OutAndAboutSheet", lambda m: repl(m), t)
io.open(p2, 'w', encoding='utf-8').write(t2)
print('② 转场面板改为不点外面关闭（改了', count, '处）')
