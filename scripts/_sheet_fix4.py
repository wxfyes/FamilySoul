import io
p = 'mobile/lib/views/out_and_about_sheet.dart'
s = io.open(p, encoding='utf-8').read()

# ① 高度与键盘：整块上移，绝不顶出屏幕
s = s.replace("""    final clock = (d?['clock'] is Map) ? d!['clock'] as Map : const {};
    return SafeArea(
      child: Container(
        height: MediaQuery.of(context).size.height * 0.62,""",
"""    final clock = (d?['clock'] is Map) ? d!['clock'] as Map : const {};
    final kb = MediaQuery.of(context).viewInsets.bottom;
    final screenH = MediaQuery.of(context).size.height;
    final sheetH = ((screenH - kb) * 0.80).clamp(240.0, screenH);
    return Padding(
      padding: EdgeInsets.only(bottom: kb),
      child: SafeArea(
      child: Container(
        height: sheetH,""", 1)

# ② 面板内点空白只收键盘
s = s.replace("""        child: Column(
          children: [
            Container(
              width: 40,
              height: 4,""",
"""        child: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          child: Column(
          children: [
            Container(
              width: 40,
              height: 4,""", 1)

# ③ 收尾：Column / GestureDetector / Container / SafeArea / Padding
s = s.replace("""          ],
        ),
      ),
    );
  }

  Widget _places(Map<String, dynamic>? d) {""",
"""          ],
        ),
        ),
      ),
      ),
    );
  }

  Widget _places(Map<String, dynamic>? d) {""", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('已改：跟随键盘 / 点空白只收键盘 / 括号闭合')
