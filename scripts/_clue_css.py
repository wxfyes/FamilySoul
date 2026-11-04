import io
p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()

# ① 线索行：正文占满，日期不换行
old = """  $('clues').innerHTML = cls.length ? cls.map(c =>
    `<div class="row"><span>${String(c.text || '').replace(/</g,'&lt;')}</span><span class="muted">第${c.day}日 · ${c.source || ''}</span></div>`
  ).join('') : '<div class="muted">还没有线索</div>';"""
new = """  $('clues').innerHTML = cls.length ? cls.map(c =>
    `<div class="row clue-row"><span class="clue-text">${String(c.text || '').replace(/</g,'&lt;')}</span><span class="muted clue-meta">第${c.day}日${c.source ? ' · ' + c.source : ''}</span></div>`
  ).join('') : '<div class="muted">还没有线索</div>';"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 线索行结构改好')

# ② 补 CSS（只加这一类，不动全局 row）
css = """
.clue-row{align-items:flex-start}
.clue-text{flex:1;min-width:0;line-height:1.5}
.clue-meta{white-space:nowrap;flex:none;margin-left:12px;font-size:12px}
"""
if '.clue-row' not in s:
    s = s.replace('</style>', css + '</style>', 1)
    print('② 补 CSS')
io.open(p, 'w', encoding='utf-8').write(s)
