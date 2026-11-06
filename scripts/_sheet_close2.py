import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
old = """                  onTap: () {
                    Navigator.pop(ctx);
                    showModalBottomSheet(
                      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
                      builder: (_) => OutAndAboutSheet(api: provider.api, onChanged: _refreshPlace),
                    ).then((_) => _refreshPlace());
                  },"""
new = """                  onTap: () {
                    Navigator.pop(ctx);
                    showModalBottomSheet(
                      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
                      isDismissible: false,
                      builder: (_) => OutAndAboutSheet(api: provider.api, onChanged: _refreshPlace),
                    ).then((_) => _refreshPlace());
                  },"""
if old in s and 'isDismissible: false,\n                      builder: (_) => OutAndAboutSheet' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('③ 第三处也加上了')
