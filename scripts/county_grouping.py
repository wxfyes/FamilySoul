import io

# ---------- ① 名字去重：重名就换一个名 ----------
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """      const { name: countyName } = makeOfficialName(cityName);"""
new = """      let countyName = makeOfficialName(cityName).name;
      // 重名就再取一个（最多试 8 次）
      for (let attempt = 0; attempt < 8; attempt++) {
        const clash = Object.values(world.actors || {}).some((x) => x && x.name === countyName);
        if (!clash) break;
        countyName = makeOfficialName(cityName + '#' + attempt + '#' + countyId).name;
      }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 知县取名去重')

io.open(p, 'w', encoding='utf-8').write(s)

# ---------- ② 看板：朝中卡把知县挂到所属府下面 ----------
p2 = 'web/dashboard.html'
d = io.open(p2, encoding='utf-8').read()

old2 = """      local.map(([, o]) => `<div class="off-item"><span class="muted">${o.title}</span><b>${labelOf(o)}</b></div>`).join('') +"""
new2 = """      local.map(([k, o]) => {
        const cityName = String(k).replace(/^city:/, '');
        const county = (w.actors || []).find(a => String(a.role || '') === `${cityName}知县`);
        let sub = '';
        if (county) {
          const cr = county.relations || {};
          sub = `<div class="muted" style="font-size:11px;margin-top:2px">└ 知县 ${county.name} <span style="opacity:.75">信${Number(cr.trust)||0} 怨${Number(cr.grievance)||0} 欲${Number(cr.desire)||0}</span></div>`;
        }
        return `<div class="off-item"><span class="muted">${o.title}</span><b>${labelOf(o)}</b>${sub}</div>`;
      }).join('') +"""
if old2 in d:
    d = d.replace(old2, new2, 1)
    print('② 朝中卡知县挂到府下')
else:
    print('WARN: 朝中 local 渲染没找到')

io.open(p2, 'w', encoding='utf-8').write(d)
print('done')
