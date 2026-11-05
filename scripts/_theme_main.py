import io
# ① main.dart 接上主题控制器
p = 'mobile/lib/main.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import 'providers/chat_provider.dart';",
              "import 'providers/chat_provider.dart';\nimport 'services/theme_controller.dart';", 1)
s = s.replace("        ChangeNotifierProvider(create: (_) => ChatProvider()),",
              "        ChangeNotifierProvider(create: (_) => ChatProvider()),\n        ChangeNotifierProvider(create: (_) => ThemeController()),", 1)
s = s.replace("      child: MaterialApp(", "      child: Consumer<ThemeController>(\n        builder: (context, theme, _) => MaterialApp(", 1)
s = s.replace("        themeMode: ThemeMode.system,", "        themeMode: theme.mode,", 1)
s = s.replace("        home: const ChatScreen(),\n      ),", "        home: const ChatScreen(),\n        ),\n      ),", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('① main 接主题控制器')
