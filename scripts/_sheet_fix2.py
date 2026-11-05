import io
p = 'mobile/lib/views/chat_screen.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("                    _pickImage(context, provider, ImageSource.camera);",
              "                    _pickAndSendImage(ImageSource.camera);", 1)
# 老的 _buildQuickActionItem 不再使用：删掉它（避免 lint 警告）
start = s.find("  Widget _buildQuickActionItem({")
if start > 0:
    end = s.find("\n  }\n", start)
    if end > 0:
        s = s[:start] + s[end+4:]
        print('删掉未用的 _buildQuickActionItem')
io.open(p, 'w', encoding='utf-8').write(s)
