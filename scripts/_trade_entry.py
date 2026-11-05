import io
p = 'mobile/lib/views/out_and_about_sheet.dart'
s = io.open(p, encoding='utf-8').read()
if 'trade_sheet.dart' not in s:
    s = s.replace("import '../services/api_client.dart';", "import '../services/api_client.dart';\nimport 'trade_sheet.dart';", 1)
    print('引入 TradeSheet')

# 在"我的产业"标题前加一行入口胶囊
old = """        if (homes.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 6, top: 2),
            child: Text('我的产业', style: TextStyle(fontSize: 12, color: Colors.white38)),
          ),"""
new = """        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8, top: 2),
          child: Row(children: [
            InkWell(
              onTap: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => TradeSheet(api: widget.api),
                );
              },
              borderRadius: BorderRadius.circular(999),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE0B252).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(0xFFE0B252).withValues(alpha: 0.45)),
                ),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.storefront_rounded, size: 14, color: Color(0xFFE0B252)),
                  SizedBox(width: 6),
                  Text('商货行栈', style: TextStyle(color: Color(0xFFE0B252), fontSize: 12.5, fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
          ]),
        ),
        if (homes.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 6, top: 2),
            child: Text('我的产业', style: TextStyle(fontSize: 12, color: Colors.white38)),
          ),"""
if old in s:
    s = s.replace(old, new, 1)
    print('出门抽屉加商货行栈入口')
io.open(p, 'w', encoding='utf-8').write(s)
