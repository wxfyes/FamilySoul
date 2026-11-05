import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

# ① 抽屉里撤掉 今日看板 与 外观（改到 + 号菜单）
import re
start = s.find("            // 外观：日间 / 夜间 / 跟随系统")
if start > 0:
    end = s.find("            ListTile(", s.find("              ),\n            ),", start))
    # 直接定位到下一个 ListTile（今日看板）之前
    nxt = s.find("            ListTile(\n              leading: const Icon(Icons.today_rounded", start)
    if nxt > start:
        s = s[:start] + s[nxt:]
        print('① 抽屉移除外观块')

start2 = s.find("            ListTile(\n              leading: const Icon(Icons.today_rounded")
if start2 > 0:
    end2 = s.find("            ListTile(", start2 + 20)
    if end2 > start2:
        s = s[:start2] + s[end2:]
        print('② 抽屉移除今日看板块')

io.open(p, 'w', encoding='utf-8').write(s)
