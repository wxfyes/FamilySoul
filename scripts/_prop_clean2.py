import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const fake = /^(几|多|若干|一些|这个|那个|某)/.test(nm) && !/铺|号|栈|坊|楼|店|行|庄|堂/.test(nm.slice(1));"""
new = """        const fake = /^(几个|若干|多家|一些|这一个|那一个|某|好多|数个|几间|几处)/.test(nm);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 修正假产业判定')
