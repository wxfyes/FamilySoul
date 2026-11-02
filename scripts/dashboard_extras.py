import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

# ① 卡片：风评 / 案件 / 天下（行会+外交+驻军）
if 'id="rumors"' not in s:
    anchor = "  <section class=\"card full\">\n    <h2>朝中（官职）</h2>"
    cards = (
        "  <section class=\"card\">\n"
        "    <h2>街面风评</h2>\n"
        "    <div id=\"rumors\" class=\"muted\" style=\"margin-top:6px\">—</div>\n"
        "  </section>\n\n"
        "  <section class=\"card\">\n"
        "    <h2>案子</h2>\n"
        "    <div id=\"cases\" class=\"muted\" style=\"margin-top:6px\">—</div>\n"
        "  </section>\n\n"
        "  <section class=\"card\">\n"
        "    <h2>天下（行会 · 外交 · 驻军）</h2>\n"
        "    <div id=\"realm\" class=\"muted\" style=\"margin-top:6px\">—</div>\n"
        "  </section>\n\n"
        "  <section class=\"card full\">\n    <h2>朝中（官职）</h2>"
    )
    if anchor in s:
        s = s.replace(anchor, cards, 1)
        print('added rumor/case/realm cards')

# ② 渲染
if 'function renderWorldExtras' not in s:
    fn = (
        "function renderWorldExtras(w) {\n"
        "  const rum = $('rumors');\n"
        "  if (rum) {\n"
        "    const list = (w.rumors || []).slice(-6).reverse();\n"
        "    rum.innerHTML = list.length\n"
        "      ? list.map((r) => `<div class=\"row\"><span>${r.tone < 0 ? '🔻' : r.tone > 0 ? '🔺' : '·'} ${r.text}</span><span class=\"muted\">${r.reach}人知</span></div>`).join('')\n"
        "      : '街上还平静';\n"
        "  }\n"
        "  const cs = $('cases');\n"
        "  if (cs) {\n"
        "    const list = (w.cases || []).slice(-6).reverse();\n"
        "    const st = { filed: '待审', summoned: '已传唤', hearing: '开审中', judged: '已判' };\n"
        "    cs.innerHTML = list.length\n"
        "      ? list.map((c) => `<div class=\"row\"><span>${c.who} 告 ${c.against}·${c.claim}</span><span class=\"muted\">${st[c.status] || c.status}${c.verdict ? '·' + (c.verdict === 'guilty' ? '有罪' : '无罪') : ''}</span></div>`).join('')\n"
        "      : '衙门清闲';\n"
        "  }\n"
        "  const rm = $('realm');\n"
        "  if (rm) {\n"
        "    const g = (w.guilds || []).map((x) => `${x.name}·${x.head}(${x.attitude === 'hostile' ? '敌视' : x.attitude === 'friendly' ? '亲近' : '一般'})`).join('　');\n"
        "    const f = (w.foreign || []).map((x) => `${x.name}(${Math.round(x.relation)})`).join('　');\n"
        "    const gs = Object.entries(w.garrisons || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join('　');\n"
        "    rm.innerHTML = `<div class=\"row\"><span>行会</span><span class=\"muted\" style=\"text-align:right;max-width:75%\">${g || '—'}</span></div>`\n"
        "      + `<div class=\"row\"><span>邻国</span><span class=\"muted\" style=\"text-align:right;max-width:75%\">${f || '—'}</span></div>`\n"
        "      + `<div class=\"row\"><span>驻军</span><span class=\"muted\">${gs || '—'}</span></div>`\n"
        "      + (w.envoy ? `<div class=\"row\"><span>使节</span><span class=\"muted\">${w.envoy.name} 求${w.envoy.demand}</span></div>` : '')\n"
        "      + (w.imperialArmy ? `<div class=\"row\"><span>官军</span><span class=\"muted\" style=\"color:#e05a5a\">${w.imperialArmy.count}人 → ${w.imperialArmy.target}（第${w.imperialArmy.arriveDay}日到）</span></div>` : '');\n"
        "  }\n"
        "}\n\n"
    )
    s = s.replace("function renderTreasury(", fn + "function renderTreasury(", 1)
    print('added renderWorldExtras')

s = s.replace(
    "  try { renderDecrees(w.court); renderNpcArcs(w.npcArcs); renderTreasury(w.court); } catch (e) {}",
    "  try { renderDecrees(w.court); renderNpcArcs(w.npcArcs); renderTreasury(w.court); renderWorldExtras(w); } catch (e) {}",
    1,
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
