import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()

# ① 卡片：插在家宅卡之前
anchor = '<section class="card" id="card-household">'
card = '''<section class="card full" id="card-nav">
  <h2>🧭 出门 · 找人 · 赴约</h2>
  <div class="muted" id="nav-where" style="margin:4px 0 8px">—</div>
  <div id="nav-body"></div>
</section>

'''
if 'id="card-nav"' not in s:
    s = s.replace(anchor, card + anchor, 1)
    print('① 已插入交互卡片')

# ② JS：渲染与动作
js = r'''

// ── 出门 / 找人 / 赴约（走同一条管道，不碰聊天与 tick） ─────────────
async function navLoad() {
  const t = token ? token() : '';
  if (!t) return;
  try {
    const r = await fetch(`/api/world/menu?token=${encodeURIComponent(t)}`);
    const d = await r.json();
    if (!d.ok) return;
    window.__nav = d;
    navRender(d);
  } catch (e) {}
}

function navRender(d) {
  const where = $('nav-where');
  if (where) where.textContent = `你此刻在【${d.where?.name || '?'}】　（第${d.clock?.day}日 ${d.clock?.hour}时）`;
  const box = $('nav-body');
  if (!box) return;

  const placeBtn = (p) => `<button class="nav-btn" data-go="${String(p.name).replace(/"/g, '&quot;')}">${p.name}${p.names?.length ? ' · ' + p.names.join('、') : ''}</button>`;
  const pplBtn = (p) => {
    const tag = p.here ? '<span class="tag good">在场</span>' : '<span class="tag">' + (p.place || '?') + '</span>';
    const act = p.here
      ? '<span class="muted" style="font-size:11px">就在跟前</span>'
      : `<button class="nav-btn sm" data-come="${p.id}">叫她来</button>`;
    return `<div class="nav-row"><span><b>${p.name}</b> <span class="muted">${p.role || ''}</span> ${tag}</span><span>${act}</span></div>`;
  };
  const todoBtn = (x) => `<div class="nav-row"><span><span class="tag">${x.kind}</span> ${x.when}${x.who ? ' ' + x.who : ''} ${x.text || ''}</span>
      <span>${x.kind === '约定' ? `<button class="nav-btn sm" data-apt="${x.id}">赴约</button>` : ''}
      <button class="nav-btn sm ghost" data-drop="${x.id}">取消</button></span></div>`;

  const byGroup = (g) => (d.people || []).filter((p) => p.group === g);
  box.innerHTML = `
    <div class="nav-cols">
      <div>
        <div class="nav-title">去哪儿</div>
        <div class="nav-chips">${(d.places || []).map(placeBtn).join('') || '<span class="muted">附近没人</span>'}</div>
        <div class="nav-title" style="margin-top:8px">我的产业</div>
        <div class="nav-chips">${(d.homes || []).map((h) => `<button class="nav-btn" data-go="${String(h.name).replace(/"/g, '&quot;')}">${h.name}</button>`).join('') || '<span class="muted">无</span>'}</div>
      </div>
      <div>
        <div class="nav-title">找人</div>
        ${['府内', '相好', '其他人'].map((g) => {
          const list = byGroup(g).slice(0, g === '其他人' ? 6 : 12);
          if (!list.length) return '';
          return `<div class="muted" style="margin:6px 0 2px">${g}</div>` + list.map(pplBtn).join('');
        }).join('')}
      </div>
      <div>
        <div class="nav-title">待办</div>
        ${(d.todos || []).length ? d.todos.map(todoBtn).join('') : '<div class="muted">没有约定与承诺</div>'}
      </div>
    </div>`;

  box.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', async () => {
    await navPost('/api/world/go', { place: b.getAttribute('data-go') });
  }));
  box.querySelectorAll('[data-come]').forEach((b) => b.addEventListener('click', async () => {
    await navPost('/api/world/summon', { id: b.getAttribute('data-come') });
  }));
  box.querySelectorAll('[data-apt]').forEach((b) => b.addEventListener('click', async () => {
    await navPost('/api/world/todo', { id: b.getAttribute('data-apt'), action: 'go' });
  }));
  box.querySelectorAll('[data-drop]').forEach((b) => b.addEventListener('click', async () => {
    await navPost('/api/world/todo', { id: b.getAttribute('data-drop'), action: 'drop' });
  }));
}

async function navPost(path, payload) {
  const t = token ? token() : '';
  try {
    await fetch(`${path}?token=${encodeURIComponent(t)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
  } catch (e) {}
  if (typeof refresh === 'function') refresh();
  navLoad();
}

document.addEventListener('DOMContentLoaded', () => { setTimeout(navLoad, 600); });
window.__navLoad = navLoad;
'''
idx = s.rfind('</script>')
if idx > 0 and 'function navLoad' not in s:
    s = s[:idx] + js + '\n' + s[idx:]
    print('② 已插入交互 JS')

# ③ 样式
css = """
.nav-cols{display:grid;grid-template-columns:1.1fr 1.2fr 1fr;gap:14px}
@media(max-width:900px){.nav-cols{grid-template-columns:1fr}}
.nav-title{font-size:12px;opacity:.6;margin-bottom:4px}
.nav-chips{display:flex;flex-wrap:wrap;gap:6px}
.nav-btn{background:rgba(120,150,255,.12);border:1px solid rgba(120,150,255,.28);color:#cfe0ff;border-radius:8px;padding:4px 9px;font-size:12px;cursor:pointer}
.nav-btn:hover{background:rgba(120,150,255,.22)}
.nav-btn.sm{padding:2px 8px;font-size:11px}
.nav-btn.ghost{background:transparent;border-color:rgba(255,255,255,.18);color:#9aa4b8}
.nav-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12.5px}
"""
if '.nav-cols' not in s:
    s = s.replace('</style>', css + '</style>', 1)
    print('③ 已插入样式')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
