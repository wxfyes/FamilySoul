import io
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    const roleName = ageWord;"""
new = """    // 新入世的人：一律是普通百姓（布衣），年岁只作描述，不给身份头衔
    const roleName = '布衣';"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 新人身份＝布衣')
