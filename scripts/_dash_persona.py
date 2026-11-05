import io
# 看板：婚配与身子直接用后端给的中文，不再自己推"未婚"
p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()

old_fn = """function maritalText(a) {
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
}"""
new_fn = """function maritalText(a) {
  if (!a) return '—';
  if (a.maritalText) return a.maritalText;      // 后端按世情算好的中文
  if (a.id === 'husband') return '已婚 · 妻妾在侧';
  if (a.spouseName) return `已婚 · ${a.spouseName}`;
  if (a.household) return '已婚 · 王府内眷';
  return a.marital === 'single' ? '未婚 · 待字闺中' : '—';
}"""
if old_fn in s:
    s = s.replace(old_fn, new_fn, 1)
    print('① 看板婚配用后端中文')

# 后院内宅"身孕与气血"：育龄无孕时用后端 bodyText（绝经/幼女不再留白）
old_cell = """        let pregHtml = '<span class="muted">未孕</span>';
        if (isPreg(a)) {"""
new_cell = """        let pregHtml = `<span class="muted">${a.bodyText || '未孕'}</span>`;
        if (isPreg(a)) {"""
if old_cell in s:
    s = s.replace(old_cell, new_cell, 1)
    print('② 后院身子用后端中文')
io.open(p, 'w', encoding='utf-8').write(s)
