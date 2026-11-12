import re

with open('web/dashboard.html', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. 增加 CSS 样式：.table-scroll-container、吸顶表头与平滑细滚动条
old_css_mark = "/* 表格美化 */"
new_css_block = """/* 📜 表格滚动容器与吸顶表头 (下拉滚动式) */
  .table-scroll-container {
    max-height: 520px;
    overflow-y: auto;
    overflow-x: auto;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.12);
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
  }
  .table-scroll-container::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .table-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }
  .table-scroll-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 3px;
  }
  .table-scroll-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.35);
  }
  .table-scroll-container thead th {
    position: sticky;
    top: 0;
    background: #151922;
    z-index: 5;
    box-shadow: 0 1px 0 var(--border-color);
  }

  /* 表格美化 */"""

if old_css_mark in c:
    c = c.replace(old_css_mark, new_css_block, 1)
    print("Added table-scroll-container CSS!")
else:
    print("Could not find old_css_mark!")

# 2. 修改 tab-family HTML，增加后院眷属与身孕完整大板块
old_tab_family = """      <!-- ══════════════════════════════════════════════════
           3. 🏡 后院内宅 Tab (各房眷属、身孕名分、各自心事)
           ══════════════════════════════════════════════════ -->
      <div class="tab-pane" id="tab-family">
        <section class="card full">
          <h2>🌸 各自主线与心事（她们自己的人生羁绊）</h2>
          <div id="arcs">—</div>
        </section>
        <section class="card full">
          <h2>💬 佳人原话（字字句句，亲口道来）</h2>
          <div id="quotes">—</div>
        </section>
      </div>"""

new_tab_family = """      <!-- ══════════════════════════════════════════════════
           3. 🏡 后院内宅 Tab (各房眷属、身孕名分、各自心事)
           ══════════════════════════════════════════════════ -->
      <div class="tab-pane" id="tab-family">
        <!-- 🏡 后院妻妾眷属与身孕谱系独立大卡 -->
        <section class="card full" id="card-family-full">
          <div class="card-header">
            <h2>🏡 后院内宅眷属与身孕谱系 <span class="muted" style="font-size:13px;font-weight:400">（名分位份 · 居所卧房 · 怀胎身孕 · 房事心境）</span></h2>
            <span class="pill primary" id="f-house-summary">正妻 — · 侧室 — · 通房 —</span>
          </div>
          <div class="table-scroll-container" style="max-height: 420px;">
            <table>
              <thead>
                <tr>
                  <th>佳人</th>
                  <th>位份名分</th>
                  <th>所居处所</th>
                  <th>身孕与气血</th>
                  <th>私房银两</th>
                  <th>对相公心境</th>
                  <th>同榻亲密</th>
                </tr>
              </thead>
              <tbody id="family-full-rows"></tbody>
            </table>
          </div>
        </section>

        <section class="card full">
          <h2>🌸 各房主线与心事（她们自己的人生羁绊）</h2>
          <div id="arcs">—</div>
        </section>
        <section class="card full">
          <h2>💬 佳人原话（字字句句，亲口道来）</h2>
          <div id="quotes">—</div>
        </section>
      </div>"""

if old_tab_family in c:
    c = c.replace(old_tab_family, new_tab_family)
    print("Replaced tab-family HTML successfully!")
else:
    print("Could not find old_tab_family!")

# 3. 修改 tab-actors HTML 中的包裹容器为 table-scroll-container
old_actors_container = """          <div style="overflow-x:auto;">
            <table>
              <thead><tr><th>名字</th><th>来源</th><th>身份</th><th>所在</th><th>私房钱</th><th>信任</th><th>欲望</th><th>怨怼</th><th>态度</th><th>亲密</th></tr></thead>
              <tbody id="actors"></tbody>
            </table>
          </div>"""

new_actors_container = """          <div class="table-scroll-container">
            <table>
              <thead><tr><th>名字</th><th>来源</th><th>身份</th><th>所在</th><th>私房钱</th><th>信任</th><th>欲望</th><th>怨怼</th><th>态度</th><th>亲密</th></tr></thead>
              <tbody id="actors"></tbody>
            </table>
          </div>"""

if old_actors_container in c:
    c = c.replace(old_actors_container, new_actors_container)
    print("Replaced actors container with table-scroll-container!")
else:
    print("Could not find old_actors_container!")

# 4. 修改 JS 里的 actors 渲染：取消 slice(0, 10)，全量支持滚动，去掉底部的“展开全部”链接
old_actors_js = """  const shown = window.__actorExpand ? list : list.slice(0, 10);
  $('actors').innerHTML = shown.map(a=>{
    const r = a.relations||{}, im = a.intimacy||{};
    // 相公本人：没有"对自己的好感"，改显示他自己的实况
    if (a.id === 'husband') {
      const _silver = Number(w.assets?.silver ?? 0);
      const _income = (w.assets?.properties || []).reduce((x, y) => x + (Number(y.incomePerDay) || 0), 0);
      const _troops = Number(w.military?.total) || ((Number(w.military?.guards)||0) + (Number(w.military?.militia)||0) + (Number(w.military?.army)||0));
      const _offices = (w.officeHolders || []).length;
      return `<tr style="cursor:pointer" onclick="openActor('${a.id}')">
        <td><b>${a.name}</b> <span class="tag good">本人</span></td>
        <td><span class="tag">${a.origin==='spawned'?'天道衍生':'预设'}</span></td>
        <td class="muted">${a.role || '相公'}</td>
        <td class="muted">${a.place || '—'}</td>
        <td class="num">${_silver.toFixed(0)} <span class="muted">府库</span></td>
        <td class="num muted" colspan="3" style="text-align:left">银 ${_silver.toFixed(0)} 两 · 日入 ${_income.toFixed(1)} · 兵 ${_troops} · 官职 ${_offices}</td>
        <td class="muted">此刻：${a.place || '—'}</td>
        <td><span class="tag">—</span></td>
      </tr>`;
    }
    const bar = (v, cls = '') => `<div class="bar"><i class="${cls}" style="width:${Math.max(0,Math.min(100,v))}%\"></i></div>`;
    let intimacy = im.ritual==='unlocked' ? '解禁·档'+(im.tone??0) : (im.consummated?'相好':'端庄');
    if (a.pregnancy && !a.pregnancy.born) intimacy = '有孕 · ' + Math.floor((a.pregnancy.days||0)/30) + '个月';
    if (a.onPeriod) intimacy = '月事中';
    return `<tr style="cursor:pointer" onclick="openActor('${a.id}')">
      <td><b>${a.name}</b></td><td><span class="tag">${a.origin==='spawned'?'天道衍生':'预设'}</span></td><td class="muted">${a.role||''}</td><td class="muted">${a.place||''}</td>
      <td class="num">${typeof a.money === 'number' ? a.money.toFixed(1) + (a.debt ? ' <span class="bad">欠'+a.debt+'</span>' : '') : '—'}</td>
      <td class="num">${r.trust??'—'} ${bar(r.trust||0, 'trust')}</td>
      <td class="num">${r.desire??'—'} ${bar(r.desire||0, 'desire')}</td>
      <td class="num">${r.grievance??0} ${bar(r.grievance||0, 'grievance')}</td>
      <td>${a.id==='husband'?'—':attitude({...a, household:a.household, consummated:im.consummated, relations:r})}</td>
      <td><span class="tag">${a.id==='husband'?'—':intimacy}</span></td>
    </tr>`;
  }).join('') + (list.length > 10
    ? `<tr><td colspan="10" style="text-align:center;padding:8px"><a href="javascript:void(0)" onclick="window.__actorExpand=!window.__actorExpand;load();" style="color:#7fb4ff">${window.__actorExpand ? '收起' : '展开全部（共 ' + list.length + ' 人）'}</a></td></tr>`
    : '');"""

new_actors_js = """  // 全量渲染列表，通过表格外层 table-scroll-container 实现丝滑下拉滚动
  $('actors').innerHTML = list.map(a=>{
    const r = a.relations||{}, im = a.intimacy||{};
    // 相公本人：没有"对自己的好感"，改显示他自己的实况
    if (a.id === 'husband') {
      const _silver = Number(w.assets?.silver ?? 0);
      const _income = (w.assets?.properties || []).reduce((x, y) => x + (Number(y.incomePerDay) || 0), 0);
      const _troops = Number(w.military?.total) || ((Number(w.military?.guards)||0) + (Number(w.military?.militia)||0) + (Number(w.military?.army)||0));
      const _offices = (w.officeHolders || []).length;
      return `<tr style="cursor:pointer" onclick="openActor('${a.id}')">
        <td><b>${a.name}</b> <span class="tag good">本人</span></td>
        <td><span class="tag">${a.origin==='spawned'?'天道衍生':'预设'}</span></td>
        <td class="muted">${a.role || '相公'}</td>
        <td class="muted">${a.place || '—'}</td>
        <td class="num">${_silver.toFixed(0)} <span class="muted">府库</span></td>
        <td class="num muted" colspan="3" style="text-align:left">银 ${_silver.toFixed(0)} 两 · 日入 ${_income.toFixed(1)} · 兵 ${_troops} · 官职 ${_offices}</td>
        <td class="muted">此刻：${a.place || '—'}</td>
        <td><span class="tag">—</span></td>
      </tr>`;
    }
    const bar = (v, cls = '') => `<div class="bar"><i class="${cls}" style="width:${Math.max(0,Math.min(100,v))}%\"></i></div>`;
    let intimacy = im.ritual==='unlocked' ? '解禁·档'+(im.tone??0) : (im.consummated?'相好':'端庄');
    if (a.pregnancy && !a.pregnancy.born) intimacy = '有孕 · ' + Math.floor((a.pregnancy.days||0)/30) + '个月';
    if (a.onPeriod) intimacy = '月事中';
    return `<tr style="cursor:pointer" onclick="openActor('${a.id}')">
      <td><b>${a.name}</b></td><td><span class="tag">${a.origin==='spawned'?'天道衍生':'预设'}</span></td><td class="muted">${a.role||''}</td><td class="muted">${a.place||''}</td>
      <td class="num">${typeof a.money === 'number' ? a.money.toFixed(1) + (a.debt ? ' <span class="bad">欠'+a.debt+'</span>' : '') : '—'}</td>
      <td class="num">${r.trust??'—'} ${bar(r.trust||0, 'trust')}</td>
      <td class="num">${r.desire??'—'} ${bar(r.desire||0, 'desire')}</td>
      <td class="num">${r.grievance??0} ${bar(r.grievance||0, 'grievance')}</td>
      <td>${a.id==='husband'?'—':attitude({...a, household:a.household, consummated:im.consummated, relations:r})}</td>
      <td><span class="tag">${a.id==='husband'?'—':intimacy}</span></td>
    </tr>`;
  }).join('');"""

if old_actors_js in c:
    c = c.replace(old_actors_js, new_actors_js)
    print("Updated actors JS to full-scrollable successfully!")
else:
    print("Could not find old_actors_js!")

# 5. 在 JS 中渲染 family-full-rows
old_family_code = """    let html = '';
    if (inHouse.length) {
      html += `<div class="muted" style="margin:4px 0 2px">府内</div>`;
      html += inHouse.map(a => rowOf(a, rankOf(a))).join('');
    }
    if (outHouse.length) {
      html += `<div class="muted" style="margin:8px 0 2px">外室 · 不入府（世人不知）</div>`;
      html += outHouse.map(a => rowOf(a, '相好')).join('');
    }
    $('family-detail').innerHTML = html || '<div class="muted">府中尚无内眷</div>';
  }"""

new_family_code = """    let html = '';
    if (inHouse.length) {
      html += `<div class="muted" style="margin:4px 0 2px">府内</div>`;
      html += inHouse.map(a => rowOf(a, rankOf(a))).join('');
    }
    if (outHouse.length) {
      html += `<div class="muted" style="margin:8px 0 2px">外室 · 不入府（世人不知）</div>`;
      html += outHouse.map(a => rowOf(a, '相好')).join('');
    }
    $('family-detail').innerHTML = html || '<div class="muted">府中尚无内眷</div>';

    // ── 🏡 后院内宅专属 Tab 完整谱系表格渲染 ──────────────────
    if ($('family-full-rows')) {
      const allWomen = [...inHouse, ...outHouse];
      $('f-house-summary').textContent =
        `正妻 ${mainCnt('正妻')} · 侧室 ${mainCnt('二房')} · 通房 ${mainCnt('通房')}`
        + (outHouse.length ? ` ｜ 外室 ${outHouse.length}${outPreg ? `（${outPreg} 有孕）` : ''}` : '');

      $('family-full-rows').innerHTML = allWomen.map(a => {
        const isOut = !a.household;
        const rankTag = isOut ? '<span class="tag warn">外室 · 相好</span>' : `<span class="tag good">${rankOf(a)}</span>`;
        const pregDays = Number(a.pregnancy?.days) || 0;
        const pregMonth = Math.floor(pregDays / 30);
        let pregHtml = '<span class="muted">未孕</span>';
        if (isPreg(a)) {
          pregHtml = `<span class="tag good" style="font-weight:600">🤱 有喜 ${pregDays} 天 (${pregMonth}个月)</span>`;
        } else if (a.onPeriod) {
          pregHtml = '<span class="tag warn">🩸 月事中</span>';
        } else if (a.fertile) {
          pregHtml = '<span class="tag good">🌸 易孕期</span>';
        }

        const r = a.relations || {};
        const im = a.intimacy || {};
        let intimacyText = im.ritual === 'unlocked' ? `解禁 · 档${im.tone ?? 0}` : (im.consummated ? '已欢好 · 相好' : '端庄守礼');

        return `<tr style="cursor:pointer" onclick="openActor('${a.id}')">
          <td><b>${a.name}</b> ${a.household ? '<span class="tag" style="margin-left:4px">府内</span>' : '<span class="tag muted" style="margin-left:4px">外室</span>'}</td>
          <td>${rankTag} <span class="muted" style="margin-left:4px">${a.role || ''}</span></td>
          <td class="muted">${a.place || '—'}</td>
          <td>${pregHtml}</td>
          <td class="num">${typeof a.money === 'number' ? a.money.toFixed(1) + ' 两' : '—'}</td>
          <td class="muted">${attitude({...a, household: a.household, consummated: im.consummated, relations: r})}</td>
          <td><span class="tag">${intimacyText}</span></td>
        </tr>`;
      }).join('') || '<tr><td colspan="7" class="muted" style="text-align:center;padding:12px;">暂无内眷女眷数据</td></tr>';
    }
  }"""

if old_family_code in c:
    c = c.replace(old_family_code, new_family_code)
    print("Added full family rows rendering logic!")
else:
    print("Could not find old_family_code!")

with open('web/dashboard.html', 'w', encoding='utf-8') as f:
    f.write(c)
print("Finished all patches for scroll & family tab!")

