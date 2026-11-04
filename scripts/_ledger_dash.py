import io
# 看板：银两卡下加"最近流水"
p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()
i = s.find('<h2>💰 银两与日入</h2>')
if i < 0:
    print('WARN: 找不到银两卡')
else:
    j = s.find('</section>', i)
    add = '''  <div id="ledger" style="margin-top:10px"></div>
'''
    s = s[:j] + add + s[j:]
    print('插入 ledger 容器')

# 渲染逻辑：接在 renderTreasury 之后注册（在 render() 里调用）
if 'function renderLedger' not in s:
    fn = '''
function renderLedger(w) {
  const el = $('ledger');
  if (!el) return;
  const rows = (w.ledger || []).filter(Boolean);
  if (!rows.length) { el.innerHTML = '<div class="muted" style="font-size:12px">还没有银两流水</div>'; return; }
  el.innerHTML = '<div class="muted" style="font-size:12px;margin-bottom:4px">最近流水</div>' + rows.map((r) => {
    const sign = Number(r.delta) > 0 ? '+' : '';
    const color = Number(r.delta) > 0 ? '#4ade80' : '#f87171';
    return `<div class="row" style="font-size:12.5px"><span>第${r.day}日${r.hour}时 ${r.title}</span><span style="color:${color}">${sign}${r.delta} 两</span></div>`;
  }).join('');
}
'''
    s = s.replace('function renderTreasury(court) {', fn + '\nfunction renderTreasury(court) {', 1)
    s = s.replace('renderWorldExtras(w); renderBondMap(w);', 'renderWorldExtras(w); renderBondMap(w); renderLedger(w);', 1)
    print('加渲染并挂到 render()')
io.open(p, 'w', encoding='utf-8').write(s)
