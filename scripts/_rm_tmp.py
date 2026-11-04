import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "    if (false) { /* 暂时停用，定位回归失败 */ }\n"
if old in s:
    s = s.replace(old, "", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('已移除临时停用')
else:
    print('无临时停用残留')
