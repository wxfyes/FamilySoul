import io
p = 'mobile/lib/views/assistant_view.dart'
s = io.open(p, encoding='utf-8').read()

# ① 助手气泡加：身份小胶囊 + 时间（与世界同款观感）
old = """                          Flexible(
                            child: GestureDetector(
                              onLongPress: () {"""
new = """                          Flexible(
                            child: Column(
                              crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                              children: [
                                if (!isUser)
                                  Padding(
                                    padding: const EdgeInsets.only(left: 2, bottom: 4),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF3B82F6).withValues(alpha: isDark ? 0.22 : 0.10),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.35)),
                                      ),
                                      child: const Text('天机助手',
                                          style: TextStyle(fontSize: 10.5, color: Color(0xFF60A5FA))),
                                    ),
                                  ),
                                GestureDetector(
                              onLongPress: () {"""
if old in s and '天机助手' in new:
    s = s.replace(old, new, 1)
    # 在气泡 Container 结束后补：时间 + 闭合 Column
    old2 = """                              ),
                            ),
                          ),
                          if (isUser) ...["""
    new2 = """                              ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  DateFormat('HH:mm').format(msg.at),
                                  style: TextStyle(fontSize: 10, color: Colors.white.withValues(alpha: 0.28)),
                                ),
                              ],
                            ),
                          ),
                          if (isUser) ...["""
    if old2 in s:
        s = s.replace(old2, new2, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 助手气泡加身份与时间')

# ② 引入 DateFormat
if "package:intl/intl.dart" not in s:
    s = io.open(p, encoding='utf-8').read()
    s = s.replace("import 'package:flutter/material.dart';", "import 'package:flutter/material.dart';\nimport 'package:intl/intl.dart';", 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('② 引入 intl')
