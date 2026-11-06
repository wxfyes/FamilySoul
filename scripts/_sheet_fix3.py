import io
p = 'mobile/lib/views/out_and_about_sheet.dart'
lines = io.open(p, encoding='utf-8').read().split('\n')
# 修正收尾括号：Column / GestureDetector / Container / SafeArea / Padding
start = None
for i, l in enumerate(lines):
    if l.strip() == '],' and i > 160 and lines[i+1].strip() == '),':
        start = i
        break
if start:
    lines[start:start+5] = ['          ],', '          ),', '        ),', '      ),', '      ),', '    );']
    print('修正收尾括号')
# 高度改成"键盘弹出后剩余高度"的比例，避免顶出屏幕
s = '\n'.join(lines)
s = s.replace("""    final kb = MediaQuery.of(context).viewInsets.bottom;""",
"""    final kb = MediaQuery.of(context).viewInsets.bottom;
    final screenH = MediaQuery.of(context).size.height;
    final sheetH = ((screenH - kb) * 0.80).clamp(240.0, screenH);""", 1)
s = s.replace("        height: MediaQuery.of(context).size.height * 0.62,", "        height: sheetH,", 1)
io.open(p, 'w', encoding='utf-8').write(s)
