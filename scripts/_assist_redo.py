import io
p = 'mobile/lib/views/assistant_view.dart'
s = io.open(p, encoding='utf-8').read()

# ① 反转列表 + 索引映射
s = s.replace(""": ListView.builder(
                  controller: _scrollController,""",
""": ListView.builder(
                  controller: _scrollController,
                  reverse: true,""", 1)
s = s.replace("final msg = _messages[i];",
              "// reverse: 0 就是最新一条\n                    final msg = _messages[_messages.length - 1 - i];", 1)

# ② 滚动目标改为 0（reverse 下 0 即底部最新）
s = s.replace("_scrollController.jumpTo(_scrollController.position.maxScrollExtent);",
              "_scrollController.jumpTo(0);", 1)

# ③ 输入条胶囊
start = s.find("        // 底部问答输入框")
end = s.find("      ],\n    );\n  }\n}", start)
if start > 0 and end > 0:
    bar = """        // 底部输入条：与世界同款胶囊（左相机 / 中输入 / 右语音 + 发送）
        Container(
          padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF12131A) : const Color(0xFFF8FAFC),
            border: Border(top: BorderSide(color: Colors.grey.withValues(alpha: 0.12))),
          ),
          child: SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1C202B) : Colors.white,
                borderRadius: BorderRadius.circular(26),
                border: Border.all(color: Colors.grey.withValues(alpha: 0.18)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: '发一张图给助手看',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    icon: const Icon(Icons.camera_alt_outlined, size: 22, color: Color(0xFF94A3B8)),
                    onPressed: _pickImage,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: TextField(
                      controller: _inputController,
                      maxLines: 4,
                      minLines: 1,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      style: TextStyle(fontSize: 15, color: isDark ? Colors.white : const Color(0xFF1E293B)),
                      decoration: InputDecoration(
                        hintText: '向天机助手提问任何事…',
                        hintStyle: TextStyle(fontSize: 14.5, color: isDark ? Colors.white38 : Colors.grey.shade400),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: '按住说话',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    icon: Icon(_listening ? Icons.mic_rounded : Icons.graphic_eq_rounded,
                        size: 22, color: _listening ? const Color(0xFFEF4444) : const Color(0xFF94A3B8)),
                    onPressed: _toggleMic,
                  ),
                  const SizedBox(width: 2),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _inputController,
                    builder: (ctx, v, _) {
                      final has = v.text.trim().isNotEmpty;
                      return GestureDetector(
                        onTap: has ? _sendMessage : null,
                        child: Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: has ? const Color(0xFF3B82F6) : (isDark ? const Color(0xFF2A2F3D) : const Color(0xFFE2E8F0)),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(has ? Icons.arrow_upward_rounded : Icons.add_rounded,
                              size: 20, color: has ? Colors.white : const Color(0xFF94A3B8)),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
"""
    s = s[:start] + bar
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已改：反转列表 / 滚动跳 0 / 胶囊输入条')
else:
    print('未找到输入条范围', start, end)
