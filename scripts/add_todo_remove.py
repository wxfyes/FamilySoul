import io

# 服务端：单条删除承诺/暗涌
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.26b 删除单条承诺/暗涌 POST /api/admin/todo/remove {kind, text}\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/todo/remove') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const world = peek(DATA_DIR);\n"
    "        const kind = String(body.kind || 'promise');\n"
    "        const text = String(body.text || '').slice(0, 80);\n"
    "        if (!text) return sendJson(res, 400, { ok: false, error: '缺少 text' });\n"
    "        let removed = 0;\n"
    "        if (kind === 'pending') {\n"
    "          const before = (world.pending || []).length;\n"
    "          world.pending = (world.pending || []).filter((x) => String(x?.desc || '') !== text);\n"
    "          removed = before - world.pending.length;\n"
    "        } else {\n"
    "          const before = (world.promises || []).length;\n"
    "          world.promises = (world.promises || []).filter((x) => String(x?.text || '') !== text);\n"
    "          removed = before - world.promises.length;\n"
    "        }\n"
    "        saveState(DATA_DIR, world);\n"
    "        console.log(`[Todo] 删除${kind} ${removed} 条：${text.slice(0, 20)}`);\n"
    "        return sendJson(res, 200, { ok: true, removed });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s and '/api/admin/todo/remove' not in s:
    s = s.replace(anchor, inject, 1)
    print('added todo/remove endpoint')
else:
    print('WARN: anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)

# 看板：每条待办后面加 ✕
p2 = 'web/dashboard.html'
s2 = io.open(p2, encoding='utf-8-sig').read()
old = "    when: dayText(p.due),"
if old in s2 and 'todoRemove' not in s2:
    s2 = s2.replace(
        "    title: String(p.text||''), detail: '', extra: '',",
        "    title: String(p.text||''), detail: '', extra: '', raw: String(p.text||''), kindKey: 'promise',",
    )
    # 渲染时加删除按钮
    s2 = s2.replace(
        "`<div class=\"row\"><span class=\"tag ${r.cls}\">${r.kind}</span><span>${r.title}</span><span class=\"right\">${r.when}</span></div>`",
        "`<div class=\"row\"><span class=\"tag ${r.cls}\">${r.kind}</span><span>${r.title}</span><span class=\"right\">${r.when} <a href=\"javascript:void(0)\" onclick=\"todoRemove('${r.kindKey || 'promise'}', this)\" data-text=\"${(r.raw || '').replace(/\"/g,'&quot;')}\" style=\"color:#e05a5a;margin-left:8px\">✕</a></span></div>`",
    )
    print('patched dashboard row delete link')
else:
    print('WARN: dashboard row template not found')

# 删除函数
if 'function todoRemove' not in s2:
    s2 = s2.replace(
        "async function doBind(memberKey) {",
        "async function todoRemove(kind, el) {\n"
        "  const tk = token();\n"
        "  const text = el?.dataset?.text || '';\n"
        "  if (!tk || !text) return;\n"
        "  if (!confirm('删除这条待办？')) return;\n"
        "  try {\n"
        "    const r = await fetch(`/api/admin/todo/remove?token=${encodeURIComponent(tk)}`, {\n"
        "      method: 'POST', headers: { 'Content-Type': 'application/json' },\n"
        "      body: JSON.stringify({ kind, text }),\n"
        "    });\n"
        "    const j = await r.json();\n"
        "    if (j.ok) load(); else alert('删除失败：' + (j.error || ''));\n"
        "  } catch (e) { alert('删除失败：' + e.message); }\n"
        "}\n\n"
        "async function doBind(memberKey) {",
        1,
    )
    print('added todoRemove function')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
