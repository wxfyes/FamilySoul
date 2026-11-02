import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "    $('bind').innerHTML = members.map(m => {"
)
new = (
    "    const seenKeys = new Set();\n"
    "    const uniq = members.filter((m) => { if (seenKeys.has(m.key)) return false; seenKeys.add(m.key); return true; });\n"
    "    const boundList = uniq.filter((m) => m.actor);\n"
    "    const shownList = window.__bindExpand ? uniq : boundList;\n"
    "    $('bind').innerHTML = shownList.map(m => {"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: dedupe + bound-only')

old2 = (
    "    }).join('') || '<tr><td colspan=\"4\" class=\"muted\">没有成员</td></tr>';"
)
new2 = (
    "    }).join('') + (uniq.length > boundList.length\n"
    "      ? `<tr><td colspan=\"4\" style=\"text-align:center;padding:8px\"><a href=\"javascript:void(0)\" onclick=\"window.__bindExpand=!window.__bindExpand;load();\" style=\"color:#7fb4ff\">${window.__bindExpand ? '收起' : '展开全部（共 ' + uniq.length + ' 个账号）'}</a></td></tr>`\n"
    "      : '');"
)
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('patched: bind expand toggle')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
