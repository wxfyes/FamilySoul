import io
p = 'scripts/regress.py'
s = io.open(p, encoding='utf-8').read()
old = """@case('她回家 → 只动她自己')
def c1():"""
new = """@case('文字说回家 → 谁都不动（移动只认界面）')
def c1():"""
s = s.replace(old, new, 1)

old2 = """console.log(s.actors.liuwenxia.location === 'wine_shop' && s.actors.husband.location === 'tea_house' ? 'PASS' : 'FAIL 她=' + s.actors.liuwenxia.location + ' 他=' + s.actors.husband.location);"""
new2 = """console.log(s.actors.liuwenxia.location === 'street' && s.actors.husband.location === 'tea_house' ? 'PASS（文字不移动）' : 'FAIL 她=' + s.actors.liuwenxia.location + ' 他=' + s.actors.husband.location);"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('已更新用例：文字不移动')
io.open(p, 'w', encoding='utf-8').write(s)
