import io

p = 'web/dashboard.html'
lines = io.open(p, encoding='utf-8').read().split('\n')

# 找到 人物行模板
start = None
for i, l in enumerate(lines):
    if "$('actors').innerHTML = shown.map(a=>{" in l:
        start = i
        break
if start is None:
    print('WARN: 人物行模板没找到')
else:
    end = None
    for j in range(start, start + 20):
        if lines[j].strip().endswith('}).join(\'\') + (list.length > 10'):
            end = j
            break
    if end is None:
        print('WARN: 模板结尾没找到')
    else:
        new_block = r"""  $('actors').innerHTML = shown.map(a=>{
    const r = a.relations||{}, im = a.intimacy||{};
    const bar = v => `<div class="bar"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></div>`;
    let intimacy = im.ritual==='unlocked' ? '解禁·档'+(im.tone??0) : (im.consummated?'相好':'端庄');
    if (a.pregnancy && !a.pregnancy.born) intimacy = '有孕 · ' + Math.floor((a.pregnancy.days||0)/30) + '个月';

    // 相公本人那一行：没有"他对自己的好感"，改显示他自己的实况
    if (a.id === 'husband') {
      const silver = Number(w.assets?.silver ?? 0);
      const props = (w.assets?.properties || []);
      const income = props.reduce((s, x) => s + (Number(x.incomePerDay) || 0), 0);
      const troops = Number(w.military?.total) || (Number(w.military?.guards)||0) + (Number(w.military?.militia)||0) + (Number(w.military?.army)||0);
      const offices = (w.officeHolders || []).length;
      return `<tr style="cursor:pointer" onclick="openActor('${a.id}')">
        <td><b>${a.name}</b> <span class="tag good">本人</span></td>
        <td><span class="tag">${a.origin==='spawned'?'天道衍生':'预设'}</span></td>
        <td class="muted">${a.role || '相公'}</td>
        <td class="muted">${a.place || '—'}</td>
        <td class="num" colspan="3" style="text-align:left">
          <span class="muted">银 ${silver.toFixed(0)} 两 · 日入 ${income.toFixed(1)} · 兵 ${troops} · 官职 ${offices}</span>
        </td>
        <td class="muted">此刻所在：${a.place || '—'}</td>
        <td><span class="tag">—</span></td>
      </tr>`;
    }

    return `<tr style="cursor:pointer" onclick="openActor('${a.id}')">
      <td><b>${a.name}</b></td><td><span class="tag">${a.origin==='spawned'?'天道衍生':'预设'}</span></td><td class="muted">${a.role || ''}</td>
      <td class="muted">${a.place || ''}</td>
      <td class="num">${r.trust??'—'} ${bar(r.trust||0)}</td>
      <td class="num">${r.desire??'—'} ${bar(r.desire||0)}</td>
      <td class="num">${r.grievance??0} ${bar(r.grievance||0)}</td>
      <td>${attitude({...a, household:a.household, consummated:im.consummated, relations:r})}</td>
      <td><span class="tag">${intimacy}</span></td>
    </tr>`;
  }).join('') + (list.length > 10"""
        lines = lines[:start] + new_block.split('\n') + lines[end:]
        print('已改写人物行模板：相公显示自己的实况')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('done')
