import io
# ① 人物列表接口补 age
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'age: Number(a.age) || null,' not in s:
    old = "            money: typeof a.money === 'number' ? a.money : null,"
    new = "            age: Number(a.age) || null,\n            money: typeof a.money === 'number' ? a.money : null,"
    s = s.replace(old, new, 1)
    print('① 列表接口补 age')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 人物表身份列显示年龄
p2 = 'web/dashboard.html'
h = io.open(p2, encoding='utf-8').read()
old2 = """<td class="muted">${a.role || ''}</td>
      <td class="muted">${a.place || ''}</td>"""
new2 = """<td class="muted">${a.role || ''}${a.age ? ' · ' + a.age + '岁' : ''}</td>
      <td class="muted">${a.place || ''}</td>"""
if old2 in h:
    h = h.replace(old2, new2, 1)
    print('② 人物表身份列加年龄')
io.open(p2, 'w', encoding='utf-8').write(h)
