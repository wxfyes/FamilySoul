import io
# 修 lint：异步后不再用 context
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
old = """                final ok = await showDialog<bool>(
                  context: context,"""
new = """                final navCtx = context;
                final ok = await showDialog<bool>(
                  context: navCtx,"""
if old in s:
    s = s.replace(old, new, 1)
    print('抓一份 context 供弹窗用')
io.open(p, 'w', encoding='utf-8').write(s)
