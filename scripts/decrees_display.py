import io

# ① /api/me：带上最近旨意
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        return sendJson(res, 200, {\n          ok: true,\n          me:"
if old in s and 'decrees:' not in s:
    # 找到该响应对象里的合适位置：在 arc 之后加
    s = s.replace(
        "            arc: {",
        "            decrees: (world.court?.decisions || []).slice(-3).map((d) => ({ day: d.day, text: d.text })),\n"
        "            arc: {",
        1,
    )
    print('patched: decrees in /api/me')
else:
    print('WARN: api/me response not found')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 看板：朝中卡片显示最近旨意
p2 = 'web/dashboard.html'
s2 = io.open(p2, encoding='utf-8-sig').read()
if 'id="decrees"' not in s2:
    s2 = s2.replace(
        "    <h2>朝中（官职）</h2>",
        "    <h2>朝中（官职）</h2>\n    <div id=\"decrees\" class=\"muted\" style=\"margin:6px 0 10px\">—</div>",
        1,
    )
    print('added decrees div')

if 'function renderDecrees' not in s2:
    fn = (
        "function renderDecrees(court) {\n"
        "  const el = $('decrees');\n"
        "  if (!el) return;\n"
        "  const ds = (court?.decisions || []).slice(-3).reverse();\n"
        "  el.innerHTML = ds.length\n"
        "    ? '最近旨意：' + ds.map((d) => `<span style=\"color:#d8c48a\">第${d.day}日「${d.text}」</span>`).join('　')\n"
        "    : '最近旨意：暂无';\n"
        "}\n\n"
    )
    s2 = s2.replace("function whoSearch(", fn + "function whoSearch(", 1)
    print('added renderDecrees')

if 'renderDecrees(w.court)' not in s2:
    s2 = s2.replace("  const list = (w.actors||[])", "  try { renderDecrees(w.court); } catch (e) {}\n  const list = (w.actors||[])", 1)
    print('wired renderDecrees')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
