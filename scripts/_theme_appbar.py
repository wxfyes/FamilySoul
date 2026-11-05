import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
anchor = """          // 豆包同款语音播报开关（开启才请求火山TTS，关闭省额度）"""
add = """          // 外观：点一下切换 日间/夜间/跟随系统，长按打开三选一
          Builder(builder: (ctx) {
            final theme = ctx.watch<ThemeController>();
            final icon = theme.mode == ThemeMode.light
                ? Icons.light_mode_rounded
                : (theme.mode == ThemeMode.dark ? Icons.dark_mode_rounded : Icons.brightness_auto_rounded);
            return IconButton(
              icon: Icon(icon, color: const Color(0xFFA78BFA)),
              tooltip: '外观：${theme.label}',
              onPressed: () {
                final next = theme.mode == ThemeMode.system
                    ? ThemeMode.light
                    : (theme.mode == ThemeMode.light ? ThemeMode.dark : ThemeMode.system);
                theme.setMode(next);
              },
              onLongPress: () => _showThemeSheet(context),
            );
          }),
""" + anchor
if 'Icons.brightness_auto_rounded' not in s.split('Widget build')[1][:6000] if 'Widget build' in s else True:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 顶栏加外观切换')
