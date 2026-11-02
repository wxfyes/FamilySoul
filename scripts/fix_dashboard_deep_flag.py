import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

old = "body: JSON.stringify({ id, relations: $('rsWorld').checked, clearPregnancy: $('rsWorld').checked, clearMemories: $('rsMem').checked }),"
new = "body: JSON.stringify({ id, relations: $('rsWorld').checked, clearPregnancy: $('rsWorld').checked, clearMemories: $('rsMem').checked, deep: $('rsDeep').checked }),"
if old in s:
    s = s.replace(old, new)
    print('patched: send deep flag')
else:
    print('WARN: reset body not found')

# 如果页面里没有 rsDeep 勾选框，补一个
if "id=\"rsDeep\"" not in s:
    anchor = "<label class=\"muted\"><input type=\"checkbox\" id=\"rsMem\" checked> 她的记忆</label>"
    if anchor in s:
        s = s.replace(anchor, anchor + "\n        <label class=\"muted\"><input type=\"checkbox\" id=\"rsDeep\"> 深度抹除（原话/约定/承诺/事件/对话）</label>")
        print('added rsDeep checkbox')
    else:
        print('WARN: rsMem label not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
