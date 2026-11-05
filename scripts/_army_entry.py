import io
# 抽屉里加「家兵」入口（放在出门之后）
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

if "army_sheet.dart" not in s:
    s = s.replace("import 'out_and_about_sheet.dart';", "import 'out_and_about_sheet.dart';\nimport 'army_sheet.dart';", 1)
    print('① 引入 ArmySheet')

anchor = """            ListTile(
              leading: const Icon(Icons.payments_rounded, color: Color(0xFFE0B252)),"""
block = """            ListTile(
              leading: const Icon(Icons.groups_rounded, color: Color(0xFF8B5CF6)),
              title: const Text('家兵', style: TextStyle(color: Colors.white)),
              subtitle: const Text('募兵 · 购粮 · 军械 · 驻军', style: TextStyle(color: Colors.white38, fontSize: 11.5)),
              onTap: () {
                Navigator.pop(context);
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => ArmySheet(
                    api: provider.api,
                    onChanged: () => setState(() {}),
                  ),
                );
              },
            ),
""" + anchor
if '家兵' not in s:
    s = s.replace(anchor, block, 1)
    print('② 抽屉加家兵入口')
io.open(p, 'w', encoding='utf-8').write(s)
