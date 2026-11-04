import io

p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
changed = []

# ① 位置条常显（没拿到时显示"定位中…"）
old = """                // 📍 位置条：随时知道自己在哪（点一下＝出门）
                if (_placeName.isNotEmpty)
                  InkWell("""
new = """                // 📍 位置条：随时知道自己在哪（点一下＝出门）
                Builder(builder: (ctx) {
                  if (_placeName.isEmpty) {
                    WidgetsBinding.instance.addPostFrameCallback((_) => _refreshPlace());
                  }
                  return InkWell("""
if old in s:
    s = s.replace(old, new, 1)
    changed.append('位置条常显')

# 缩进调整：原来 InkWell 内容需要整体多缩进两格，且在末尾闭合 Builder
old_tail = """                          const Icon(Icons.keyboard_arrow_right_rounded, size: 15, color: Colors.white24),
                        ],
                      ),
                    ),
                  ),
                if (!isOnline && provider.isInitialized)"""
new_tail = """                          const Icon(Icons.keyboard_arrow_right_rounded, size: 15, color: Colors.white24),
                        ],
                      ),
                    ),
                  );
                }),
                if (!isOnline && provider.isInitialized)"""
if old_tail in s:
    s = s.replace(old_tail, new_tail, 1)
    changed.append('闭合 Builder')

# ② 文案：空的时候显示"定位中…"
s = s.replace("""                            child: Text(
                              _placeName,
                              style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                              overflow: TextOverflow.ellipsis,
                            ),""",
"""                            child: Text(
                              _placeName.isEmpty ? '定位中…' : _placeName,
                              style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                              overflow: TextOverflow.ellipsis,
                            ),""", 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('改动:', '、'.join(changed) if changed else '无')
