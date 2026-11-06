import io
p = 'mobile/lib/views/out_and_about_sheet.dart'
s = io.open(p, encoding='utf-8').read()

# ① 面板高度跟着键盘走：键盘弹起时整块上移，绝不被遮住
old = """    return SafeArea(
      child: Container(
        height: MediaQuery.of(context).size.height * 0.62,"""
new = """    final kb = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: kb),
      child: SafeArea(
      child: Container(
        height: MediaQuery.of(context).size.height * 0.62,"""
if old in s:
    s = s.replace(old, new, 1)
    # 收尾补一个括号
    s = s.replace("""          ],
        ),
      ),
    );
  }""",
"""          ],
        ),
      ),
      ),
    );
  }""", 1)
    print('① 面板跟随键盘')

# ② 面板内点空白只收键盘，不关面板
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
io.open(p, 'w', encoding='utf-8').write(s)
print('② 面板内点空白只收键盘')
