import io, re

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()

# ① 表头加「私房钱」
old_head = '<th>所在</th>'
if old_head in s:
    s = s.replace(old_head, '<th>所在</th><th>私房钱</th>', 1)
    print('① 表头加私房钱')
else:
    print('WARN: 表头没找到')

# ② 普通行：所在后面插入私房钱
old_row = """      <td class="muted">${a.place || ''}</td>
      <td class="num">${r.trust??'—'} ${bar(r.trust||0)}</td>"""
new_row = """      <td class="muted">${a.place || ''}</td>
      <td class="num">${typeof a.money === 'number' ? a.money.toFixed(1) + (a.debt ? ' <span class="bad">欠'+a.debt+'</span>' : '') : '—'}</td>
      <td class="num">${r.trust??'—'} ${bar(r.trust||0)}</td>"""
if old_row in s:
    s = s.replace(old_row, new_row, 1)
    print('② 普通行加私房钱')
else:
    print('WARN: 普通行没找到')

# ③ 相公行：加一格（显示府库）
old_h = """        <td class="muted">${a.place || '—'}</td>
        <td class="num muted" colspan="3" style="text-align:left">"""
new_h = """        <td class="muted">${a.place || '—'}</td>
        <td class="num">${_silver.toFixed(0)} <span class="muted">府库</span></td>
        <td class="num muted" colspan="3" style="text-align:left">"""
if old_h in s:
    s = s.replace(old_h, new_h, 1)
    print('③ 相公行加府库格')
else:
    print('WARN: 相公行没找到')

# ④ 展开链接 colspan 9 → 10
s = s.replace('colspan="9"', 'colspan="10"')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
