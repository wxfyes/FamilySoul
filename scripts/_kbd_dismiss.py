import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()

old = """                Expanded(
                  child: provider.messages.isEmpty
                      ? _buildEmptyState(characterName)
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          itemCount: provider.messages.length,
                          itemBuilder: (context, index) {
                            final msg = provider.messages[index];
                            return MessageBubble(
                              message: msg,
                              characterName: characterName,
                            );
                          },
                        ),
                ),"""
new = """                Expanded(
                  // 豆包同款：点空白处收回输入法；点输入框再弹出
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
                    child: provider.messages.isEmpty
                        ? _buildEmptyState(characterName)
                        : ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                            itemCount: provider.messages.length,
                            itemBuilder: (context, index) {
                              final msg = provider.messages[index];
                              return MessageBubble(
                                message: msg,
                                characterName: characterName,
                              );
                            },
                          ),
                  ),
                ),"""
if old in s and '键盘' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 点空白收键盘 + 拖动收键盘')
