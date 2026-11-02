import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  const list = (w.actors||[]).slice().sort((a,b)=> (a.id==='husband'?-1:0)-(b.id==='husband'?-1:0));\n"
    "  $('actors').innerHTML = list.map(a=>{"
)
new = (
    "  const list = (w.actors||[]).slice().sort((a,b)=> (a.id==='husband'?-1:0)-(b.id==='husband'?-1:0));\n"
    "  const shown = window.__actorExpand ? list : list.slice(0, 10);\n"
    "  $('actors').innerHTML = shown.map(a=>{"
)
if old in s:
    s = s.replace(old, new)
    print('patched: show first 10 actors')
else:
    print('WARN: list render not found')

old2 = "  }).join('');\n\n  $('summary').textContent"
new2 = (
    "  }).join('') + (list.length > 10\n"
    "    ? `<tr><td colspan=\"9\" style=\"text-align:center;padding:8px\"><a href=\"javascript:void(0)\" onclick=\"window.__actorExpand=!window.__actorExpand;load();\" style=\"color:#7fb4ff\">${window.__actorExpand ? '收起' : '展开全部（共 ' + list.length + ' 人）'}</a></td></tr>`\n"
    "    : '');\n\n  $('summary').textContent"
)
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: expand toggle')
else:
    print('WARN: summary anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
