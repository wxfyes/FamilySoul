import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "      <span><span class=\"tag ${r.cls}\">${r.kind}</span> <b>${r.title}</b> ${r.detail?`<span class=\"muted\">${r.detail}</span>`:''} ${r.extra?`<span class=\"muted\">（${r.extra}）</span>`:''}</span>\n"
    "      <span>${r.when}</span>"
)
new = (
    "      <span><span class=\"tag ${r.cls}\">${r.kind}</span> <b>${r.title}</b> ${r.detail?`<span class=\"muted\">${r.detail}</span>`:''} ${r.extra?`<span class=\"muted\">（${r.extra}）</span>`:''}</span>\n"
    "      <span>${r.when}${r.kind==='承诺'||r.kind==='暗涌'?` <a href=\"javascript:void(0)\" onclick=\"todoRemove('${r.kind==='暗涌'?'pending':'promise'}, this)\" data-text=\"${String(r.title||'').replace(/\"/g,'&quot;')}\" style=\"color:#e05a5a;margin-left:10px;text-decoration:none\">✕</a>`:''}</span>"
)
if old in s:
    s = s.replace(old, new)
    print('patched todo row with delete link')
else:
    print('WARN: row template mismatch')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
