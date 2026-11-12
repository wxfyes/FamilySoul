import re

with open('web/dashboard.html', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. 增加 CSS 样式
old_css_mark = "/* 📜 表格滚动容器与吸顶表头 (下拉滚动式) */"
new_court_css = """/* 🏛️ 庙堂朝政与百官自适应网格卡片 */
  .off-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 10px;
  }
  .off-scroll-box {
    max-height: 480px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 6px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
  }
  .off-scroll-box::-webkit-scrollbar { width: 6px; }
  .off-scroll-box::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 3px;
  }
  .off-scroll-box::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.35);
  }
  .off-card {
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: all var(--transition-fast);
  }
  .off-card:hover {
    border-color: rgba(56, 189, 248, 0.4);
    background: rgba(255, 255, 255, 0.04);
    transform: translateY(-1px);
  }
  .off-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
    padding-bottom: 6px;
  }
  .off-post {
    font-size: 12px;
    font-weight: 600;
    color: #93c5fd;
    background: rgba(59, 130, 246, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }
  .off-post.central {
    color: #fde047;
    background: rgba(234, 179, 8, 0.12);
    border-color: rgba(234, 179, 8, 0.25);
  }
  .off-who {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
  }
  .off-name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
  }
  .off-name:hover {
    color: var(--accent-cyan);
    text-decoration: underline;
  }
  .off-tags {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .off-sub-box {
    margin-top: 4px;
    padding-top: 5px;
    border-top: 1px dotted rgba(255, 255, 255, 0.08);
    font-size: 11.5px;
    color: var(--text-dim);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* 📜 表格滚动容器与吸顶表头 (下拉滚动式) */"""

if old_css_mark in c:
    c = c.replace(old_css_mark, new_court_css, 1)
    print("Added court CSS successfully!")
else:
    print("Could not find old_css_mark!")

# 2. 替换 tab-court 的 HTML 结构
old_court_html = """      <!-- ══════════════════════════════════════════════════
           6. 🏛️ 庙堂朝政 Tab (朝中文武、案子、国库律令)
           ══════════════════════════════════════════════════ -->
      <div class="tab-pane" id="tab-court">
        <section class="card full">
          <h2>🏛️ 朝中官职与百官</h2>
          <div id="decrees" class="muted" style="margin:6px 0 4px">—</div>
          <div id="treasury" class="muted" style="margin:0 0 10px">—</div>
          <div id="court">—</div>
        </section>
        <section class="card full">
          <h2>⚖️ 官府案卷（公堂卷宗）</h2>
          <div id="cases" class="muted" style="margin-top:6px">—</div>
        </section>
      </div>"""

new_court_html = """      <!-- ══════════════════════════════════════════════════
           6. 🏛️ 庙堂朝政 Tab (朝中文武、国库圣谕、案卷公堂)
           ══════════════════════════════════════════════════ -->
      <div class="tab-pane" id="tab-court">
        <!-- 顶部天子圣意与国库财赋横幅 -->
        <div class="grid-cards" style="margin-bottom: 14px;">
          <section class="card" style="margin-bottom:0;">
            <h2>📜 当今天子与当朝圣谕</h2>
            <div id="court-mandate" style="margin:6px 0 8px;">—</div>
            <div id="decrees" class="muted">—</div>
          </section>
          <section class="card" style="margin-bottom:0;">
            <h2>🏛️ 大内国库与天下仓储</h2>
            <div id="treasury" style="margin-top:6px;">—</div>
          </section>
        </div>

        <!-- 中枢内阁与六部重臣 -->
        <section class="card full" style="margin-bottom: 14px;">
          <div class="card-header">
            <h2>👑 中枢内阁与六部尚书 <span class="muted" style="font-size:12px;font-weight:400">（首辅掌国、尚书治事）</span></h2>
          </div>
          <div id="court-central" class="off-grid"></div>
        </section>

        <!-- 各省各府父母官（带滚动与工整卡片网格） -->
        <section class="card full" style="margin-bottom: 14px;">
          <div class="card-header">
            <h2>🏯 两淮与各省府衙父母官 <span class="muted" style="font-size:12px;font-weight:400" id="court-local-count">（共 56 府）</span></h2>
          </div>
          <div class="off-scroll-box">
            <div id="court-local" class="off-grid"></div>
          </div>
        </section>

        <!-- 保持对老 DOM ID #court 的隐藏兼容 -->
        <div id="court" style="display:none;"></div>

        <!-- 官府案卷 -->
        <section class="card full">
          <h2>⚖️ 官府案卷（公堂卷宗）</h2>
          <div id="cases" class="muted" style="margin-top:6px">—</div>
        </section>
      </div>"""

if old_court_html in c:
    c = c.replace(old_court_html, new_court_html)
    print("Replaced tab-court HTML successfully!")
else:
    print("Could not find old_court_html!")

# 3. 增强 JS 中 court, decrees, treasury 渲染逻辑
old_court_js = """  const court = w.court || {};
  const offsAll = Object.entries(court.offices || {});
  const central = offsAll.filter(([k]) => !k.startsWith('city:'));
  const local = offsAll.filter(([k]) => k.startsWith('city:'));
  const labelOf = (o) => {
    const actor = o.holder ? (w.actors || []).find(a => a.id === o.holder) : null;
    if (!o.holder) return '<span class="bad">空缺</span>';
    if (!actor) return o.holder + '（未入世）';
    const r = actor.relations || {};
    const t = Number(r.trust) || 0;
    const g = Number(r.grievance) || 0;
    const d = Number(r.desire) || 0;
    return `${actor.name} <span class="muted" style="font-size:11px">信${t} 怨${g} 欲${d}</span>`;
  };
  const mnd = court.mandate || {};
  const decCount = (court.decisions || []).length;
  const mandateTxt = mnd.quality === 'benevolent_deceived' ? '仁君·被蒙蔽' : '当今天子';
  const mandateHtml = mnd.quality
    ? `<div class="row" style="border:1px dashed #2a2f3a;border-radius:6px;padding:6px 8px;margin-bottom:8px"><span>天意</span><span class="muted">${mandateTxt} · ${mnd.note || ''}${mnd.wrath ? ' · <span class="bad">天罚已降</span>' : ''}${decCount ? ' · <span class="bad">有弑君待决</span>' : ''}</span></div>`
    : '';
  const courtBody = offsAll.length
    ? `<div class="off-block"><div class="off-title">中枢</div><div class="off-grid">` +
      central.map(([, o]) => `<div class="off-item"><span class="muted">${o.title}</span><b>${labelOf(o)}</b></div>`).join('') +
      `</div></div><div class="off-block"><div class="off-title">各府父母官（${local.length}）</div><div class="off-grid">` +
      local.map(([k, o]) => {
        const cityName = String(k).replace(/^city:/, '');
        const county = (w.actors || []).find(a => String(a.role || '') === `${cityName}知县`);
        let sub = '';
        if (county) {
          const cr = county.relations || {};
          sub = `<div class="muted" style="font-size:11px;margin-top:2px">└ 知县 ${county.name} <span style="opacity:.75">信${Number(cr.trust)||0} 怨${Number(cr.grievance)||0} 欲${Number(cr.desire)||0}</span></div>`;
        }
        return `<div class="off-item"><span class="muted">${o.title}</span><b>${labelOf(o)}</b>${sub}</div>`;
      }).join('') +
      `</div></div>`
    : '<div class="muted">朝廷未设官</div>';
  $('court').innerHTML = mandateHtml + courtBody;"""

new_court_js = """  const court = w.court || {};
  const offsAll = Object.entries(court.offices || {});
  const central = offsAll.filter(([k]) => !k.startsWith('city:'));
  const local = offsAll.filter(([k]) => k.startsWith('city:'));

  const cardHtmlOf = (o, isCentral = false, sub = '') => {
    const actor = o.holder ? (w.actors || []).find(a => a.id === o.holder) : null;
    let nameHtml = '';
    let tagsHtml = '';
    if (!o.holder) {
      nameHtml = '<span class="bad" style="font-size:13px">职位空缺</span>';
    } else if (!actor) {
      nameHtml = `<span class="muted" style="font-size:13px">${o.holder}（未入世）</span>`;
    } else {
      const r = actor.relations || {};
      const t = Number(r.trust) || 0;
      const g = Number(r.grievance) || 0;
      const d = Number(r.desire) || 0;
      nameHtml = `<span class="off-name" onclick="openActor('${actor.id}')">${actor.name}</span>`;
      tagsHtml = `<div class="off-tags">
        <span class="tag ${t>=60?'good':t>=30?'':'muted'}">信${t}</span>
        <span class="tag ${d>=50?'warn':'muted'}">欲${d}</span>
        ${g>0 ? `<span class="tag bad">怨${g}</span>` : ''}
      </div>`;
    }
    return `<div class="off-card">
      <div class="off-card-top">
        <span class="off-post ${isCentral ? 'central' : ''}">${o.title}</span>
        <span class="muted" style="font-size:11px">${isCentral ? '正二品至从一品' : '正四品知府'}</span>
      </div>
      <div class="off-who">
        ${nameHtml}
        ${tagsHtml}
      </div>
      ${sub ? `<div class="off-sub-box">${sub}</div>` : ''}
    </div>`;
  };

  const mnd = court.mandate || {};
  const decCount = (court.decisions || []).length;
  const mandateTxt = mnd.quality === 'benevolent_deceived' ? '仁君 · 被蒙蔽' : '当今天子';
  if ($('court-mandate')) {
    $('court-mandate').innerHTML = mnd.quality
      ? `<div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:6px;padding:8px 10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="color:#fde047;font-weight:600">👑 ${mandateTxt}</span>
            <span class="tag ${mnd.wrath ? 'bad' : 'good'}">${mnd.wrath ? '天罚已降' : '天命安定'}</span>
          </div>
          <div class="muted" style="font-size:12px;line-height:1.6">${mnd.note || '海内初平，四方归心。'} ${decCount ? ' · <span class="bad">有要案待决</span>' : ''}</div>
        </div>`
      : '<div class="muted">天命清明</div>';
  }

  if ($('court-central')) {
    $('court-central').innerHTML = central.length
      ? central.map(([, o]) => cardHtmlOf(o, true)).join('')
      : '<div class="muted">中枢官职未立</div>';
  }

  if ($('court-local')) {
    if ($('court-local-count')) $('court-local-count').textContent = `（共 ${local.length} 府）`;
    $('court-local').innerHTML = local.length
      ? local.map(([k, o]) => {
          const cityName = String(k).replace(/^city:/, '');
          const county = (w.actors || []).find(a => String(a.role || '') === `${cityName}知县`);
          let sub = '';
          if (county) {
            const cr = county.relations || {};
            sub = `<span>└ 辖下知县：<b>${county.name}</b></span><span class="muted">信${Number(cr.trust)||0} 欲${Number(cr.desire)||0}</span>`;
          }
          return cardHtmlOf(o, false, sub);
        }).join('')
      : '<div class="muted">地方未设知府</div>';
  }

  // 兜底赋值
  if ($('court')) $('court').innerHTML = 'ok';"""

if old_court_js in c:
    c = c.replace(old_court_js, new_court_js)
    print("Updated court JS to cards layout successfully!")
else:
    print("Could not find old_court_js!")

# 4. 优化 renderTreasury 和 renderDecrees 显示格式
old_treasury_func = """function renderTreasury(court) {
  const el = $('treasury');
  if (!el) return;
  const t = court?.treasury || {};
  const silver = Number(t.silver) || 0;
  const grain = Number(t.grain) || 0;
  const color = silver < 100 ? '#e05a5a' : silver < 500 ? '#d8c48a' : '#7BD88F';
  el.innerHTML = `国库 <b style="color:${color}">${silver.toFixed(1)} 两</b>　`
    + `粮仓 <b>${grain} 石</b>　`
    + `<span class="muted">日收 ${(Number(t.lastIncome)||0).toFixed(1)} / 日支 ${(Number(t.lastExpense)||0).toFixed(1)}</span>`;
}"""

new_treasury_func = """function renderTreasury(court) {
  const el = $('treasury');
  if (!el) return;
  const t = court?.treasury || {};
  const silver = Number(t.silver) || 0;
  const grain = Number(t.grain) || 0;
  const inc = Number(t.lastIncome) || 0;
  const exp = Number(t.lastExpense) || 0;
  const diff = inc - exp;
  el.innerHTML = `
    <div class="row"><span>国库现存金银</span><b class="big" style="color:var(--accent-gold);">${silver.toFixed(1)} 两</b></div>
    <div class="row"><span>天下粮仓储备</span><b class="big" style="color:var(--accent-green);">${grain} 石</b></div>
    <div class="row" style="margin-top:4px;border-top:1px dashed rgba(255,255,255,0.06);padding-top:4px;">
      <span>国库日流水结余</span>
      <span class="${diff >= 0 ? 'good' : 'bad'}" style="font-weight:600">${diff >= 0 ? '+' : ''}${diff.toFixed(1)} 两/日 <span class="muted" style="font-weight:400;margin-left:4px">(收 ${inc.toFixed(1)} / 支 ${exp.toFixed(1)})</span></span>
    </div>`;
}"""

if old_treasury_func in c:
    c = c.replace(old_treasury_func, new_treasury_func)
    print("Updated renderTreasury successfully!")
else:
    print("Could not find old_treasury_func!")

old_decrees_func = """function renderDecrees(court) {
  const el = $('decrees');
  if (!el) return;
  const ds = (court?.decisions || []).slice(-3).reverse();
  el.innerHTML = ds.length
    ? '最近旨意：' + ds.map((d) => `<span style="color:#d8c48a">第${d.day}日「${d.text}」</span>`).join('　')
    : '最近旨意：暂无';
}"""

new_decrees_func = """function renderDecrees(court) {
  const el = $('decrees');
  if (!el) return;
  const ds = (court?.decisions || []).slice(-3).reverse();
  el.innerHTML = ds.length
    ? `<div style="font-size:12.5px;color:#d8c48a;line-height:1.6">` +
      ds.map((d) => `<div style="margin-bottom:3px">📜 <b>第${d.day}日圣谕</b>：<span>「${d.text}」</span></div>`).join('') +
      `</div>`
    : '<div class="muted">最近旨意：暂无颁布</div>';
}"""

if old_decrees_func in c:
    c = c.replace(old_decrees_func, new_decrees_func)
    print("Updated renderDecrees successfully!")
else:
    print("Could not find old_decrees_func!")

with open('web/dashboard.html', 'w', encoding='utf-8') as f:
    f.write(c)
print("Finished patching court UI in web/dashboard.html")

