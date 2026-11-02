import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

# ① 人物表剔除官员
old = "  const list = (w.actors||[]).slice().sort((a,b)=> (a.id==='husband'?-1:0)-(b.id==='husband'?-1:0));"
new = (
    "  const officialIds = new Set(w.officeHolders || []);\n"
    "  const list = (w.actors||[])\n"
    "    .filter((a) => a && !officialIds.has(a.id))\n"
    "    .slice()\n"
    "    .sort((a,b)=> (a.id==='husband'?-1:0)-(b.id==='husband'?-1:0));"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: exclude officials from people table')

# 标题说明
s = s.replace(
    "    <h2>人物（数值 + 她此刻的态度）<span class=\"muted\" style=\"font-size:11px;font-weight:400\">　点人名看人物志</span></h2>",
    "    <h2>人物（数值 + 她此刻的态度）<span class=\"muted\" style=\"font-size:11px;font-weight:400\">　点人名看人物志；官员见「朝中」</span></h2>",
    1,
)

# ② 三张新卡：大事记时间线 / 趋势 / 盘点
if 'id="timeline"' not in s:
    anchor = "  <section class=\"card full\">\n    <h2>关系网（谁跟谁一伙，谁跟谁有仇）</h2>"
    cards = (
        "  <section class=\"card\">\n"
        "    <h2>趋势（近 14 日）</h2>\n"
        "    <div id=\"trend\" style=\"margin-top:6px\">—</div>\n"
        "  </section>\n\n"
        "  <section class=\"card\">\n"
        "    <h2>盘点（为什么没动静）</h2>\n"
        "    <div id=\"diag\" class=\"muted\" style=\"margin-top:6px\">—</div>\n"
        "  </section>\n\n"
        "  <section class=\"card full\">\n"
        "    <h2>大事记时间线</h2>\n"
        "    <div id=\"timeline\" class=\"muted\" style=\"margin-top:6px\">—</div>\n"
        "  </section>\n\n"
        "  <section class=\"card full\">\n    <h2>关系网（谁跟谁一伙，谁跟谁有仇）</h2>"
    )
    if anchor in s:
        s = s.replace(anchor, cards, 1)
        print('added trend/diag/timeline cards')

# ③ 渲染
if 'function renderTrends' not in s:
    fn = (
        "function sparkline(vals, color, label) {\n"
        "  if (!vals.length) return `<div class=\"muted\">${label}：还没有数据</div>`;\n"
        "  const w = 260, h = 46, max = Math.max(1, ...vals), min = Math.min(...vals);\n"
        "  const span = Math.max(1, max - min);\n"
        "  const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1)) * w},${h - ((v - min) / span) * (h - 6) - 3}`).join(' ');\n"
        "  return `<div style=\"margin-bottom:6px\"><span class=\"muted\" style=\"font-size:11px\">${label} ${vals[vals.length - 1]}</span>`\n"
        "    + `<svg width=\"${w}\" height=\"${h}\"><polyline points=\"${pts}\" fill=\"none\" stroke=\"${color}\" stroke-width=\"2\"/></svg></div>`;\n"
        "}\n"
        "function renderTrends(w) {\n"
        "  const el = $('trend');\n"
        "  if (!el) return;\n"
        "  const h = w.history || [];\n"
        "  el.innerHTML = sparkline(h.map((x) => x.unrest), '#e05a5a', '民心不安')\n"
        "    + sparkline(h.map((x) => x.price), '#d8c48a', '物价')\n"
        "    + sparkline(h.map((x) => x.treasury), '#7BD88F', '国库')\n"
        "    + `<div class=\"muted\" style=\"font-size:11px\">趋势向上＝在变坏（民心/物价）</div>`;\n"
        "}\n"
        "function renderDiag(w) {\n"
        "  const el = $('diag');\n"
        "  if (!el) return;\n"
        "  const rows = [];\n"
        "  const day = w.clock?.day || 1, hour = w.clock?.hour || 0;\n"
        "  if (!(w.cases || []).length) rows.push(`没有案子：民间案子每天卯时（6点）才可能出，现在第${day}日${hour}时`);\n"
        "  if (!(w.rumors || []).length) rows.push('没有风评：判了案、出了大事才会生风评');\n"
        "  const unrest = (w.cities ? Object.values(w.cities) : []).reduce((a, c) => a + (Number(c.unrest) || 0), 0) / Math.max(1, Object.keys(w.cities || {}).length);\n"
        "  rows.push(`平均民心不安 ${Math.round(unrest)}（≥85 才会民变）`);\n"
        "  if (!(w.npcArcs || []).length) rows.push('NPC 命运还没生成：每个心跳补 5 个');\n"
        "  el.innerHTML = rows.map((r) => `<div class=\"row\"><span>${r}</span></div>`).join('');\n"
        "}\n"
        "function renderTimeline(w) {\n"
        "  const el = $('timeline');\n"
        "  if (!el) return;\n"
        "  const evs = (w.recentEvents || []).slice(-40);\n"
        "  if (!evs.length) { el.innerHTML = '还没有大事'; return; }\n"
        "  const byDay = {};\n"
        "  evs.forEach((e) => { const d = e.day || (w.clock?.day || 1); (byDay[d] = byDay[d] || []).push(e.text || e.payload?.text || e.action); });\n"
        "  el.innerHTML = Object.keys(byDay).sort((a, b) => b - a).slice(0, 6).map((d) =>\n"
        "    `<div style=\"margin-bottom:6px\"><b>第${d}日</b><div style=\"margin-left:10px\">${byDay[d].slice(-6).map((t) => `· ${t}`).join('<br>')}</div></div>`\n"
        "  ).join('');\n"
        "}\n\n"
    )
    s = s.replace("function renderBondMap(", fn + "function renderBondMap(", 1)
    print('added trend/diag/timeline renderers')

s = s.replace(
    "renderBondMap(w); } catch (e) {}",
    "renderBondMap(w); renderTrends(w); renderDiag(w); renderTimeline(w); } catch (e) {}",
    1,
)

# ④ 产业行可点
s = s.replace(
    "      <tr><td><b>${p.name}</b></td>",
    "      <tr style=\"cursor:pointer\" onclick=\"openProp('${p.name}')\"><td><b>${p.name}</b></td>",
    1,
)

if 'function openProp' not in s:
    fn2 = (
        "function openProp(name) {\n"
        "  const w = window.__lastWorld || {};\n"
        "  const p = (w.assets?.properties || []).find((x) => x && x.name === name);\n"
        "  if (!p) return;\n"
        "  const wage = (Number(p.staff) || 0) * 0.12;\n"
        "  const net = (Number(p.incomePerDay) || 0) - wage;\n"
        "  $('amName').textContent = `产业：${p.name}`;\n"
        "  $('amBody').innerHTML = `\n"
        "    <div>东家：${p.owner === 'husband' ? '王甯' : (p.owner || '—')}　掌柜：${p.keeper === 'husband' ? '王甯' : (p.keeper || '—')}</div>\n"
        "    <div>日入：${Number(p.incomePerDay || 0).toFixed(2)} 两　人手：${p.staff || 0} 人　工钱：${wage.toFixed(2)} 两/日</div>\n"
        "    <div>净入：<b>${net.toFixed(2)} 两/日</b>　月约：<b>${(net * 30).toFixed(1)} 两</b></div>\n"
        "    <div>状态：${p.status || '—'}　城市：${p.city || '—'}</div>`;\n"
        "  $('actorModal').style.display = 'block';\n"
        "}\n\n"
    )
    s = s.replace("function openCity(", fn2 + "function openCity(", 1)
    print('added openProp')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
