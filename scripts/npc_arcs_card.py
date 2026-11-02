import io

# ① /api/admin/world 带上 npcArcs（含人名）
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        arcs: world.arcs || {},"
new = (
    "        arcs: world.arcs || {},\n"
    "        npcArcs: Object.entries(world.npcArcs || {})\n"
    "          .filter(([, a]) => a && a.lastStep)\n"
    "          .map(([id, a]) => ({ id, name: world.actors?.[id]?.name || id, text: a.lastStep, day: a.day || 0 }))\n"
    "          .sort((x, y) => (y.day || 0) - (x.day || 0))\n"
    "          .slice(0, 12),"
)
if old in s and 'npcArcs: Object.entries' not in s:
    s = s.replace(old, new, 1)
    print('patched: npcArcs in admin world')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 看板：新增"城中动静"卡片（放在势力与兵力那一排，占满第四格）
p2 = 'web/dashboard.html'
s2 = io.open(p2, encoding='utf-8-sig').read()

if 'id="npcarcs"' not in s2:
    anchor = "  <section class=\"card\">\n    <h2>朝中（官职）</h2>"
    card = (
        "  <section class=\"card\">\n"
        "    <h2>城中动静（各人自己的事）</h2>\n"
        "    <div id=\"npcarcs\" class=\"muted\" style=\"margin-top:6px\">—</div>\n"
        "  </section>\n\n"
        "  <section class=\"card\">\n    <h2>朝中（官职）</h2>"
    )
    if anchor in s2:
        s2 = s2.replace(anchor, card, 1)
        print('added npcarcs card')

if 'function renderNpcArcs' not in s2:
    fn = (
        "function renderNpcArcs(list) {\n"
        "  const el = $('npcarcs');\n"
        "  if (!el) return;\n"
        "  const rows = (list || []).slice(0, 8);\n"
        "  el.innerHTML = rows.length\n"
        "    ? rows.map((x) => `<div class=\"row\"><span><b>${x.name}</b></span><span class=\"muted\" style=\"max-width:70%;text-align:right\">${x.text}</span></div>`).join('')\n"
        "    : '暂时还没有动静（每 3 天各人自有一桩事）';\n"
        "}\n\n"
    )
    s2 = s2.replace("function renderDecrees(", fn + "function renderDecrees(", 1)
    print('added renderNpcArcs')

if 'renderNpcArcs(w.npcArcs)' not in s2:
    s2 = s2.replace("  try { renderDecrees(w.court); } catch (e) {}", "  try { renderDecrees(w.court); renderNpcArcs(w.npcArcs); } catch (e) {}", 1)
    print('wired renderNpcArcs')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
