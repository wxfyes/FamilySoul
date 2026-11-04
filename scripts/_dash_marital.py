import io
p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()

# ① 表头：在"身份"后加"婚配"
old_th = "<thead><tr><th>名字</th><th>来源</th><th>身份</th><th>所在</th>"
new_th = "<thead><tr><th>名字</th><th>来源</th><th>身份</th><th>婚配</th><th>所在</th>"
if old_th in s:
    s = s.replace(old_th, new_th, 1)
    print('① 表头加婚配列')

# ② 相公行：补一格（已婚·妻妾成群）
old_h = """        <td class="muted">${a.role || '相公'}</td>
        <td class="muted">${a.place || '—'}</td>"""
new_h = """        <td class="muted">${a.role || '相公'}</td>
        <td class="muted">${maritalText(a)}</td>
        <td class="muted">${a.place || '—'}</td>"""
if old_h in s:
    s = s.replace(old_h, new_h, 1)
    print('② 相公行补一格')

# ③ 普通行：补一格
old_r = """      <td><b>${a.name}</b></td><td><span class="tag">${a.origin==='spawned'?'天道衍生':'预设'}</span></td><td class="muted">${a.role||''}</td><td class="muted">${a.place||''}</"""
new_r = """      <td><b>${a.name}</b></td><td><span class="tag">${a.origin==='spawned'?'天道衍生':'预设'}</span></td><td class="muted">${a.role||''}</td><td class="muted">${maritalText(a)}</td><td class="muted">${a.place||''}</"""
if old_r in s:
    s = s.replace(old_r, new_r, 1)
    print('③ 普通行补一格')

# ④ 婚配判据：有配偶→已婚·配偶；府内女眷→已婚（王府内眷）；字段 priority
fn = """
// 婚配：优先看结构化字段，其次按"有无配偶/是否府内"推，绝不猜
function maritalText(a) {
  if (!a) return '—';
  if (a.id === 'husband') return '已婚 · 妻妾在侧';
  if (a.spouseName) return `已婚 · ${a.spouseName}`;
  const m = a.marital;
  if (m === 'married') return '已婚';
  if (m === 'widowed') return '寡居';
  if (m === 'concubine') return '侧室';
  if (m === 'single') return '未婚';
  if (a.household) return '已婚 · 王府内眷';
  return '未婚';
}
"""
if 'function maritalText' not in s:
    s = s.replace('function renderTreasury(court) {', fn + '\nfunction renderTreasury(court) {', 1)
    print('④ 加 maritalText 判据')
io.open(p, 'w', encoding='utf-8').write(s)
