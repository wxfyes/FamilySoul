import fs from 'fs';

let html = fs.readFileSync('web/dashboard.html', 'utf8');

// 1. 注入 CSS 样式
const newCss = `
  /* 🌟 今日天道焦点动态大 Banner */
  .today-focus-banner {
    background: linear-gradient(135deg, rgba(23, 27, 36, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-left: 4px solid var(--accent-gold);
    border-radius: var(--radius-md);
    padding: 14px 18px;
    margin-bottom: 16px;
    box-shadow: 0 4px 18px rgba(0,0,0,0.4);
  }
  .focus-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
    padding-bottom: 6px;
  }
  .focus-title-main {
    font-size: 13.5px;
    font-weight: 700;
    color: #fef08a;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .focus-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }
  .focus-item {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .focus-item:hover {
    border-color: rgba(56, 189, 248, 0.3);
    background: rgba(0, 0, 0, 0.35);
  }
  .focus-lbl {
    color: var(--text-dim);
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .focus-val {
    color: var(--text-main);
    font-size: 12.5px;
    line-height: 1.5;
  }

  /* 👥 城市药丸快速切换条 */
  .city-pills-bar {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 12px;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.15);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .city-pill {
    padding: 3px 11px;
    border-radius: var(--radius-full);
    font-size: 12px;
    background: var(--bg-card-sub);
    color: var(--text-muted);
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .city-pill:hover {
    color: var(--text-main);
    border-color: rgba(255, 255, 255, 0.2);
  }
  .city-pill.active {
    background: rgba(56, 189, 248, 0.18);
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.5);
    font-weight: 600;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.2);
  }
  .city-select {
    background: var(--bg-card-sub);
    border: 1px solid var(--border-color);
    color: var(--text-main);
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    font-size: 12px;
    outline: none;
    cursor: pointer;
    margin-left: auto;
  }
  .city-select:focus {
    border-color: var(--accent-blue);
  }

  /* 势力标签徽章 */
  .tag-faction-court { border-color: rgba(248, 113, 113, 0.4); color: #f87171; background: rgba(248, 113, 113, 0.08); }
  .tag-faction-wangjia { border-color: rgba(251, 191, 36, 0.4); color: #fbbf24; background: rgba(251, 191, 36, 0.08); }
  .tag-faction-canal { border-color: rgba(56, 189, 248, 0.4); color: #38bdf8; background: rgba(56, 189, 248, 0.08); }
  .tag-faction-warlord { border-color: rgba(192, 132, 252, 0.4); color: #c084fc; background: rgba(192, 132, 252, 0.08); }
`;

// 把 CSS 注入到 </style> 前
html = html.replace('</style>', newCss + '\n</style>');

// 2. 在 tab-overview 注入 今日天道焦点动态 Banner
const overviewOld = `<div class="tab-pane active" id="tab-overview">
        <!-- 今日晨报 Banner -->`;

const overviewNew = `<div class="tab-pane active" id="tab-overview">
        <!-- 今日晨报 Banner -->
        <!-- 🌟 今日天道动态焦点速报 (相公置顶一眼全览) -->
        <section class="today-focus-banner" id="card-today-focus">
          <div class="focus-header">
            <div class="focus-title-main">
              <span>🌟</span>
              <span>今日天道天下大势 · 焦点速报</span>
            </div>
            <span class="muted" id="focus-clock-sub">—</span>
          </div>
          <div class="focus-grid">
            <div class="focus-item">
              <div class="focus-lbl">🌾 粮草民生与市道</div>
              <div class="focus-val" id="foc-grain">米价 0.6 两/石 · 临江府仓充盈</div>
            </div>
            <div class="focus-item">
              <div class="focus-lbl">🌪️ 灾荒与朝廷赈恤</div>
              <div class="focus-val" id="foc-disaster">四海清平，暂无大灾告急</div>
            </div>
            <div class="focus-item">
              <div class="focus-lbl">🚩 兵戈行军与开拔</div>
              <div class="focus-val" id="foc-march">各军驻扎，暂无在途行军</div>
            </div>
            <div class="focus-item">
              <div class="focus-lbl">⏳ 今日待办与兵备</div>
              <div class="focus-val" id="foc-todo">暂无待确认调动</div>
            </div>
            <div class="focus-item" style="grid-column: 1 / -1;">
              <div class="focus-lbl">🗣️ 近来市井天下风闻</div>
              <div class="focus-val" id="foc-rumor" style="color:#d1d5db;">茶坊客商言谈平静</div>
            </div>
          </div>
        </section>`;

html = html.replace(overviewOld, overviewNew);

// 3. 在 tab-actors 增加城市快速选择栏
const actorsOld = `<div class="tab-pane" id="tab-actors">
        <section class="card full">
          <div class="card-header">
            <h2>👥 城中人物名录 <span class="muted" style="font-weight:400">（点击人名查阅人物志；官员见「朝政」）</span></h2>
          </div>
          <div class="filter-bar">
            <input type="text" id="actorSearch" class="search-input" placeholder="🔍 快速搜索人物名、身份、地点...">
            <input type="hidden" id="whoQ">
            <div id="who" style="display:none;"></div>
            <button class="btn sm" onclick="filterActors('', 'all')">全部</button>
            <button class="btn sm" onclick="filterActors('', 'here')">在场之人</button>
            <button class="btn sm" onclick="filterActors('', 'house')">府中内眷</button>
            <button class="btn sm" onclick="filterActors('', 'love')">红颜相好</button>
            <button class="btn sm" onclick="filterActors('', 'court')">官府官员</button>
          </div>
          <div class="table-scroll-container">
            <table>
              <thead><tr><th>名字</th><th>来源</th><th>身份</th><th>婚配</th><th>所在</th><th>私房钱</th><th>信任</th><th>欲望</th><th>怨怼</th><th>态度</th><th>亲密</th></tr></thead>
              <tbody id="actors"></tbody>
            </table>
          </div>`;

const actorsNew = `<div class="tab-pane" id="tab-actors">
        <section class="card full">
          <div class="card-header">
            <h2>👥 天下人物名册 <span class="muted" style="font-weight:400">（按州府/县城智能分类 · 官员百姓一览无余）</span></h2>
            <span class="pill primary" id="actors-count-pill">共 — 人</span>
          </div>

          <!-- 📍 城市/县城快速切换筛选条 -->
          <div class="city-pills-bar" id="cityPillsContainer">
            <span class="muted" style="font-size:11.5px;margin-right:4px;">📍 州府归属：</span>
            <div id="cityPillsList" style="display:inline-flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <span class="city-pill active" onclick="selectActorCity('all')">全部人物</span>
              <span class="city-pill" onclick="selectActorCity('临江府')">临江府</span>
              <span class="city-pill" onclick="selectActorCity('京城')">京城</span>
              <span class="city-pill" onclick="selectActorCity('苏州府')">苏州府</span>
              <span class="city-pill" onclick="selectActorCity('杭州府')">杭州府</span>
              <span class="city-pill" onclick="selectActorCity('扬州府')">扬州府</span>
            </div>
            <select id="citySelectDropdown" class="city-select" onchange="selectActorCity(this.value)">
              <option value="all">更多天下州府...</option>
            </select>
          </div>

          <div class="filter-bar">
            <input type="text" id="actorSearch" class="search-input" placeholder="🔍 快速搜索人物名、身份、处所、县城...">
            <input type="hidden" id="whoQ">
            <div id="who" style="display:none;"></div>
            <button class="btn sm" id="btn-filter-all" onclick="filterActors('', 'all')">全部身份</button>
            <button class="btn sm" id="btn-filter-here" onclick="filterActors('', 'here')">在场之人</button>
            <button class="btn sm" id="btn-filter-house" onclick="filterActors('', 'house')">府中内眷</button>
            <button class="btn sm" id="btn-filter-love" onclick="filterActors('', 'love')">红颜相好</button>
            <button class="btn sm" id="btn-filter-court" onclick="filterActors('', 'court')">地方知府官员</button>
          </div>
          <div class="table-scroll-container">
            <table>
              <thead><tr><th>名字</th><th>所属府县</th><th>身份</th><th>婚配</th><th>所在处所</th><th>私房银</th><th>信任</th><th>欲望</th><th>怨怼</th><th>态度</th><th>亲密</th></tr></thead>
              <tbody id="actors"></tbody>
            </table>
          </div>`;

html = html.replace(actorsOld, actorsNew);

fs.writeFileSync('web/dashboard.html', html, 'utf8');
console.log('HTML structure updated successfully.');
