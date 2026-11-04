import io
p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()
old = """  $('events').innerHTML = evs.map(e=>{
    const p = e.payload||{};
    const txt = p.text||p.desc||p.goal||p.name||'';
    return `<div class="ev"><b>第${e.day}日${e.hour}时</b> [${e.action}] ${txt}</div>`;
  }).join('') || '<div class="muted">暂无</div>';"""
new = """  $('events').innerHTML = evs.map(e=>{
    // 服务端已经翻成人话（e.text）；没有就用 payload 里的说明，绝不显示机器 action
    const txt = e.text || (e.payload||{}).text || (e.payload||{}).desc || (e.payload||{}).name || '';
    return `<div class="ev"><b>第${e.day}日${e.hour}时</b> ${txt}</div>`;
  }).join('') || '<div class="muted">暂无</div>';"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('最近世界事件改用人话')
