import io, re

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

# 1) 渲染：换成带 data 属性的 span，不依赖内联 onclick
old_row = (
    "      <span>${r.when}${r.kind==='承诺'||r.kind==='暗涌'?` <a href=\"javascript:void(0)\" onclick=\"todoRemove('${r.kind==='暗涌'?'pending':'promise'}, this)\" data-text=\"${String(r.title||'').replace(/\"/g,'&quot;')}\" style=\"color:#e05a5a;margin-left:10px;text-decoration:none\">✕</a>`:''}</span>"
)
new_row = (
    "      <span>${r.when}${(r.kind==='承诺'||r.kind==='暗涌')?` <span class=\"todo-del\" data-kind=\"${r.kind==='暗涌'?'pending':'promise'}\" data-text=\"${String(r.title||'').replace(/\"/g,'&quot;')}\">✕</span>`:''}</span>"
)
if old_row in s:
    s = s.replace(old_row, new_row)
    print('patched: data-attribute delete button')
else:
    print('WARN: row template not matched')

# 2) 样式
if '.todo-del' not in s:
    s = s.replace(
        "</style>",
        "  .todo-del { color:#e05a5a; margin-left:10px; cursor:pointer; font-weight:600; }\n"
        "  .todo-del:hover { color:#ff8080; }\n"
        "  .row.todo-armed { background:#3a1c1c; border-radius:6px; outline:1px solid #e05a5a; }\n"
        "</style>",
        1,
    )
    print('added styles')

# 3) 事件委托 + 二次确认（先高亮整条）
if 'data-kind="pending"' not in s and 'todo-del' in s:
    print('note: render patched, adding handler')

handler = (
    "// 待办删除：点 ✕ 先把整条标红，再确认；确认后调接口\n"
    "document.addEventListener('click', async (ev) => {\n"
    "  const el = ev.target.closest && ev.target.closest('.todo-del');\n"
    "  if (!el) return;\n"
    "  ev.stopPropagation();\n"
    "  const row = el.closest('.row');\n"
    "  if (!row) return;\n"
    "  if (!row.classList.contains('todo-armed')) {\n"
    "    document.querySelectorAll('.row.todo-armed').forEach((x) => x.classList.remove('todo-armed'));\n"
    "    row.classList.add('todo-armed');\n"
    "    el.textContent = '点一次确认';\n"
    "    setTimeout(() => { if (row.classList.contains('todo-armed')) { row.classList.remove('todo-armed'); el.textContent = '✕'; } }, 4000);\n"
    "    return;\n"
    "  }\n"
    "  const tk = token();\n"
    "  const text = el.dataset.text || '';\n"
    "  const kind = el.dataset.kind || 'promise';\n"
    "  try {\n"
    "    const r = await fetch(`/api/admin/todo/remove?token=${encodeURIComponent(tk)}`, {\n"
    "      method: 'POST', headers: { 'Content-Type': 'application/json' },\n"
    "      body: JSON.stringify({ kind, text }),\n"
    "    });\n"
    "    const j = await r.json();\n"
    "    if (j.ok) load(); else alert('删除失败：' + (j.error || ''));\n"
    "  } catch (e) { alert('删除失败：' + e.message); }\n"
    "});\n\n"
)
if '待办删除：点 ✕' not in s:
    s = s.replace("async function doBind(memberKey) {", handler + "async function doBind(memberKey) {", 1)
    print('added delegated handler')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
