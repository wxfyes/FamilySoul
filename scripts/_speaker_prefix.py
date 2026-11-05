import io
# ④ 说话人：按前缀排除"天道/系统/环境/旁白"这类标签
p = 'mobile/lib/models/chat_message.dart'
s = io.open(p, encoding='utf-8').read()
old = "      if (name.isNotEmpty && !{'天道', '系统', '环境', '旁白'}.contains(name)) {"
new = "      const generics = ['天道', '系统', '环境', '旁白', '场景', '提示'];\n      if (name.isNotEmpty && !generics.any((g) => name.startsWith(g))) {"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 说话人改前缀排除')
