import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
# ① 异步后使用 context：先取 messenger
s = s.replace("""                              onPressed: () async {
                                HapticFeedback.lightImpact();
                                final line = await provider.api.confirmPayment(key,
                                    actionId: _pendingAction!['id']?.toString());
                                if (!mounted) return;
                                setState(() => _pendingAction = null);
                                if (line != null) {
                                  ScaffoldMessenger.of(context).showSnackBar(""",
"""                              onPressed: () async {
                                HapticFeedback.lightImpact();
                                final messenger = ScaffoldMessenger.of(context);
                                final line = await provider.api.confirmPayment(key,
                                    actionId: _pendingAction!['id']?.toString());
                                if (!mounted) return;
                                setState(() => _pendingAction = null);
                                if (line != null) {
                                  messenger.showSnackBar(""", 1)
# ② 去掉多余花括号
s = s.replace("child: Text('$label ${price}两',", "child: Text('$label $price 两',", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('已修两处 lint')
