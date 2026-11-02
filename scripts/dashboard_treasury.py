import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

if 'id="treasury"' not in s:
    s = s.replace(
        "    <div id=\"decrees\" class=\"muted\" style=\"margin:6px 0 10px\">—</div>",
        "    <div id=\"decrees\" class=\"muted\" style=\"margin:6px 0 4px\">—</div>\n"
        "    <div id=\"treasury\" class=\"muted\" style=\"margin:0 0 10px\">—</div>",
        1,
    )
    print('added treasury div')

if 'function renderTreasury' not in s:
    fn = (
        "function renderTreasury(court) {\n"
        "  const el = $('treasury');\n"
        "  if (!el) return;\n"
        "  const t = court?.treasury || {};\n"
        "  const silver = Number(t.silver) || 0;\n"
        "  const grain = Number(t.grain) || 0;\n"
        "  const color = silver < 100 ? '#e05a5a' : silver < 500 ? '#d8c48a' : '#7BD88F';\n"
        "  el.innerHTML = `国库 <b style=\"color:${color}\">${silver.toFixed(1)} 两</b>　`\n"
        "    + `粮仓 <b>${grain} 石</b>　`\n"
        "    + `<span class=\"muted\">日收 ${(Number(t.lastIncome)||0).toFixed(1)} / 日支 ${(Number(t.lastExpense)||0).toFixed(1)}</span>`;\n"
        "}\n\n"
    )
    s = s.replace("function renderDecrees(", fn + "function renderDecrees(", 1)
    print('added renderTreasury')

s = s.replace(
    "  try { renderDecrees(w.court); renderNpcArcs(w.npcArcs); } catch (e) {}",
    "  try { renderDecrees(w.court); renderNpcArcs(w.npcArcs); renderTreasury(w.court); } catch (e) {}",
    1,
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
