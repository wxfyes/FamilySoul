import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 外观模式：日间 / 夜间 / 跟随系统（会记住，下次打开还是这个）
class ThemeController extends ChangeNotifier {
  ThemeController() {
    _load();
  }

  static const _key = 'ui.themeMode';
  ThemeMode _mode = ThemeMode.system;
  ThemeMode get mode => _mode;

  String get label => switch (_mode) {
        ThemeMode.light => '日间',
        ThemeMode.dark => '夜间',
        ThemeMode.system => '跟随系统',
      };

  Future<void> _load() async {
    try {
      final sp = await SharedPreferences.getInstance();
      final v = sp.getString(_key);
      _mode = switch (v) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };
      notifyListeners();
    } catch (_) {
      /* 读不到就跟随系统 */
    }
  }

  Future<void> setMode(ThemeMode m) async {
    _mode = m;
    notifyListeners();
    try {
      final sp = await SharedPreferences.getInstance();
      await sp.setString(_key, switch (m) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
      });
    } catch (_) {
      /* 存不下也不影响本次 */
    }
  }
}
