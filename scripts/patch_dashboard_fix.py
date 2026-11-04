import re

with open('web/dashboard.html', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. 升级 $ 为具有高容错性的安全函数
old_dollar = "const $ = (id) => document.getElementById(id);"
new_dollar = """// 终极健壮 $ 选择器：若节点不存在返回虚拟 Proxy 节点，坚决杜绝 null.textContent 白屏
const _dummyProxy = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'classList') return { add(){}, remove(){}, toggle(){}, contains: () => false };
    if (prop === 'style') return {};
    if (prop === 'options') return [];
    if (prop === 'value') return '';
    if (prop === 'innerHTML' || prop === 'textContent') return '';
    return () => {};
  },
  set: () => true
});
const $ = (id) => document.getElementById(id) || _dummyProxy;"""

if old_dollar in c:
    c = c.replace(old_dollar, new_dollar)
    print("Upgraded $ function to safe proxy!")
else:
    print("Could not find old_dollar!")

# 2. 补齐 card-diag 缺失的 c-avg, c-note, diag
old_diag_block = """            <div class="row"><span>累计轮数</span><span id="c-rounds">—</span></div>
            <div class="row"><span>缓存命中率</span><span id="c-hit">—</span></div>
            <div id="audit-box" class="muted" style="margin-top:8px">—</div>"""

new_diag_block = """            <div class="row"><span>累计轮数</span><span id="c-rounds">—</span></div>
            <div class="row"><span>平均每轮</span><span id="c-avg">—</span></div>
            <div class="row"><span>缓存命中率</span><span id="c-hit">—</span></div>
            <div class="muted" id="c-note" style="margin-top:6px"></div>
            <div id="diag" class="muted" style="margin-top:6px;display:none;"></div>
            <div id="audit-box" class="muted" style="margin-top:8px">—</div>"""

if old_diag_block in c:
    c = c.replace(old_diag_block, new_diag_block)
    print("Patched card-diag block!")
else:
    print("Could not find old_diag_block!")

# 3. 补齐 tab-business 缺失的 a-silver, a-income, a-props
old_infra_block = """        <section class="card full">
          <h2>🧱 基础设施建设</h2>
          <div id="infra">—</div>
        </section>"""

new_infra_block = """        <section class="card full">
          <h2>🧱 基础设施建设</h2>
          <div id="infra">—</div>
        </section>

        <!-- 家底统计（隐藏兼容与数据兜底） -->
        <section class="card full" style="display:none;">
          <span id="a-silver"></span>
          <span id="a-income"></span>
          <div id="a-props"></div>
        </section>"""

if old_infra_block in c:
    c = c.replace(old_infra_block, new_infra_block)
    print("Patched business infra block!")
else:
    print("Could not find old_infra_block!")

# 4. 补齐 who 和 whoQ
old_actors_block = """          <div class="filter-bar">
            <input type="text" id="actorSearch" class="search-input" placeholder="🔍 快速搜索人物名、身份、地点...">"""

new_actors_block = """          <div class="filter-bar">
            <input type="text" id="actorSearch" class="search-input" placeholder="🔍 快速搜索人物名、身份、地点...">
            <input type="hidden" id="whoQ">
            <div id="who" style="display:none;"></div>"""

if old_actors_block in c:
    c = c.replace(old_actors_block, new_actors_block)
    print("Patched actors who/whoQ block!")
else:
    print("Could not find old_actors_block!")

with open('web/dashboard.html', 'w', encoding='utf-8') as f:
    f.write(c)
print("Finished patching dashboard.html")

