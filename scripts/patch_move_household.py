with open('web/dashboard.html', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. 增加 .grid-3cols CSS 样式
old_grid_css = """.grid-4cols {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }
  @media(max-width: 1200px) { .grid-4cols { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 640px) { .grid-4cols { grid-template-columns: 1fr; } }"""

new_grid_css = """.grid-4cols {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }
  @media(max-width: 1200px) { .grid-4cols { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 640px) { .grid-4cols { grid-template-columns: 1fr; } }

  .grid-3cols {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }
  @media(max-width: 1100px) { .grid-3cols { grid-template-columns: repeat(2, 1fr); } }
  @media(max-width: 680px) { .grid-3cols { grid-template-columns: 1fr; } }"""

if old_grid_css in c:
    c = c.replace(old_grid_css, new_grid_css)
    print("Added .grid-3cols CSS!")
else:
    print("Could not find old_grid_css!")

# 2. 从首页 tab-overview 中移除 card-household，首页改为三栏大业：银两、朝堂、兵马
old_overview_cards = """        <!-- 核心四大卡片网格 -->
        <div class="grid-4cols">
          <section class="card" id="card-household">
            <h2>🏡 后院内眷</h2>
            <div class="row" style="padding-bottom:6px;"><span class="big" id="h-family-top" style="color:var(--accent-pink);">正妻 — · 侧室 — · 有孕 —</span></div>
            <div id="family-detail" style="margin-top:6px;"></div>
          </section>

          <section class="card" id="card-accounts">
            <h2>💰 银两与日入</h2>
            <div class="row" style="padding-bottom:6px;"><span class="big" id="a-acc-top" style="color:var(--accent-gold);">现存 — 两 · 日入 — 两</span></div>
            <div id="acc-detail" style="margin-top:6px;"></div>
          </section>

          <section class="card" id="card-court-core">
            <h2>🏛️ 庙堂派系</h2>
            <div class="row" style="padding-bottom:6px;"><span class="big" id="c-court-top" style="color:var(--accent-blue);">官职 — · 派系 —</span></div>
            <div id="court-detail" style="margin-top:6px;"></div>
          </section>

          <section class="card" id="card-military-core">
            <h2>⚔️ 军中兵马</h2>
            <div class="row" style="padding-bottom:6px;"><span class="big" id="m-military-top" style="color:var(--accent-green);">兵 — · 士气 —</span></div>
            <div id="military-detail" style="margin-top:6px;"></div>
          </section>
        </div>"""

new_overview_cards = """        <!-- 核心三大支柱：银两资产 · 庙堂朝政 · 江山兵马 (首页堂堂正正，后院私密收纳至专属Tab) -->
        <div class="grid-3cols">
          <section class="card" id="card-accounts">
            <h2>💰 银两与日入</h2>
            <div class="row" style="padding-bottom:6px;"><span class="big" id="a-acc-top" style="color:var(--accent-gold);">现存 — 两 · 日入 — 两</span></div>
            <div id="acc-detail" style="margin-top:6px;"></div>
          </section>

          <section class="card" id="card-court-core">
            <h2>🏛️ 庙堂派系</h2>
            <div class="row" style="padding-bottom:6px;"><span class="big" id="c-court-top" style="color:var(--accent-blue);">官职 — · 派系 —</span></div>
            <div id="court-detail" style="margin-top:6px;"></div>
          </section>

          <section class="card" id="card-military-core">
            <h2>⚔️ 军中兵马</h2>
            <div class="row" style="padding-bottom:6px;"><span class="big" id="m-military-top" style="color:var(--accent-green);">兵 — · 士气 —</span></div>
            <div id="military-detail" style="margin-top:6px;"></div>
          </section>
        </div>"""

if old_overview_cards in c:
    c = c.replace(old_overview_cards, new_overview_cards)
    print("Cleaned overview cards (removed card-household from overview)!")
else:
    print("Could not find old_overview_cards!")

# 3. 将 card-household 安置到 tab-family (后院内宅) 顶部
old_tab_family_head = """      <!-- ══════════════════════════════════════════════════
           3. 🏡 后院内宅 Tab (各房眷属、身孕名分、各自心事)
           ══════════════════════════════════════════════════ -->
      <div class="tab-pane" id="tab-family">
        <!-- 🏡 后院妻妾眷属与身孕谱系独立大卡 -->"""

new_tab_family_head = """      <!-- ══════════════════════════════════════════════════
           3. 🏡 后院内宅 Tab (各房眷属、身孕名分、各自心事)
           ══════════════════════════════════════════════════ -->
      <div class="tab-pane" id="tab-family">
        <!-- 🏡 后院各房名分与私密外室 (专属收纳于内宅，不扎眼) -->
        <section class="card full" id="card-household" style="margin-bottom:14px;">
          <h2>🏡 后院各房名分与私密外室</h2>
          <div class="row" style="padding-bottom:6px;"><span class="big" id="h-family-top" style="color:var(--accent-pink);">正妻 — · 侧室 — · 有孕 —</span></div>
          <div id="family-detail" style="margin-top:6px;"></div>
        </section>

        <!-- 🏡 后院妻妾眷属与身孕谱系独立大卡 -->"""

if old_tab_family_head in c:
    c = c.replace(old_tab_family_head, new_tab_family_head)
    print("Placed card-household into tab-family successfully!")
else:
    print("Could not find old_tab_family_head!")

with open('web/dashboard.html', 'w', encoding='utf-8') as f:
    f.write(c)
print("Finished patching move of card-household!")

