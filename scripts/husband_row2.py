import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()

# 在人物行模板里，为相公单独插入一个分支（不破坏原有三元表达式）
anchor = """  $('actors').innerHTML = shown.map(a=>{
    const r = a.relations||{}, im = a.intimacy||{};"""
if anchor not in s:
    print('WARN: 锚点没找到')
else:
    inject = """  $('actors').innerHTML = shown.map(a=>{
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
        <td class="num muted" colspan="3" style="text-align:left">银 ${_silver.toFixed(0)} 两 · 日入 ${_income.toFixed(1)} · 兵 ${_troops} · 官职 ${_offices}</td>
        <td class="muted">此刻：${a.place || '—'}</td>
        <td><span class="tag">—</span></td>
      </tr>`;
    }"""
    s = s.replace(anchor, inject, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已插入相公独立分支（未改动原模板）')
