import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

# ① 城名可点
old = '      return `<span class="chip${mine ? " mine" : ""}" title="${tip}">${name}</span>`;'
new = '      return `<span class="chip${mine ? " mine" : ""}" title="${tip}" style="cursor:pointer" onclick="openCity(\'${name}\')">${name}</span>`;'
if old in s:
    s = s.replace(old, new, 1)
    print('patched: city chip clickable')

# ② 城志弹层（复用 actorModal 容器）
if 'function openCity' not in s:
    fn = (
        "function openCity(name) {\n"
        "  const w = window.__lastWorld || {};\n"
        "  const c = (w.cities || {})[name];\n"
        "  if (!c) return;\n"
        "  const mine = c.owner === 'wangjia';\n"
        "  const gar = (w.garrisons || {})[name] || 0;\n"
        "  const props = (w.assets?.properties || []).filter((p) => p && (p.city === name || String(p.name || '').includes(name)));\n"
        "  const propHtml = props.length\n"
        "    ? props.map((p) => `${p.name}（日入 ${Number(p.incomePerDay || 0).toFixed(2)}·${p.staff || 0}人）`).join('<br>')\n"
        "    : '这城还没你的产业';\n"
        "  $('amName').textContent = `${name}　${c.region || ''}`;\n"
        "  $('amBody').innerHTML = `\n"
        "    <div>归属：${mine ? '<b style=\"color:#7BD88F\">你的</b>' : c.owner === 'court' ? '朝廷' : (c.owner || '不明')}</div>\n"
        "    <div>民心不安：<b>${c.unrest ?? 0}</b>　税率：<b>${c.tax ?? 10}%</b>　物价：<b>${c.price ?? 100}</b></div>\n"
        "    <div>守备：${c.defense ?? 0}　驻军：${gar}　财富：${Number(c.wealth || 0).toFixed(1)}</div>\n"
        "    <div>特产：${(c.goods || []).join('、') || '无'}</div>\n"
        "    <div style=\"margin-top:6px\"><b>这里的产业</b><br>${propHtml}</div>\n"
        "    <div style=\"margin-top:8px;color:#888;font-size:12px\">民心 ≥85 会民变；税越高民心掉得越快；驻军能挡流寇与官军</div>`;\n"
        "  $('actorModal').style.display = 'block';\n"
        "}\n\n"
    )
    s = s.replace("async function openActor(", fn + "async function openActor(", 1)
    print('added openCity')

# ③ 存一份 world 给弹层用
if 'window.__lastWorld = w;' not in s:
    s = s.replace("  try { renderDecrees(w.court);", "  window.__lastWorld = w;\n  try { renderDecrees(w.court);", 1)
    print('cached world for modal')

# ④ 人物表加提示
s = s.replace(
    "    <h2>人物（数值 + 她此刻的态度）</h2>",
    "    <h2>人物（数值 + 她此刻的态度）<span class=\"muted\" style=\"font-size:11px;font-weight:400\">　点人名看人物志</span></h2>",
    1,
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
