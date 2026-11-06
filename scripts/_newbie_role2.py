import io
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
# 让天道知道"布衣 + 年岁"，但身份只是布衣
old = "      role: roleName,\n      label: '新客',"
new = "      role: roleName,\n      ageWord,\n      label: '新客',"
if old in s and 'ageWord,' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 年岁另存，身份仍是布衣')
