import io, re

p = 'web/dashboard.html'
lines = io.open(p, encoding='utf-8').read().split('\n')

# ---------- ① 家宅卡：府内 vs 外室 分开算 ----------
old_start = None
for i, l in enumerate(lines):
    if '── 🏡 家宅卡' in l:
        old_start = i
        break
if old_start is None:
    print('WARN: 家宅 render 块没找到')
else:
    old_end = None
    depth = 0
    for j in range(old_start, min(old_start + 40, len(lines))):
        if re.match(r"\s*// ── 💰 账目卡", lines[j]):
            old_end = j
            break
    new_block = r'''  // ── 🏡 家宅卡：府内女眷（有名分）与外室（相好，不入府）分开 ----------
  if ($('card-household')) {
    const women = Object.values(w.actors || {}).filter(a => a && a.gender === 'female' && a.id !== 'husband');
    const inHouse = women.filter(a => a.household);
    const outHouse = women.filter(a => !a.household && (
      (a.intimacy && a.intimacy.consummated) || Number(a.relations?.husband?.trust) >= 50
    ));
    const isPreg = (a) => Boolean(a.pregnancy && !a.pregnancy.born);
    const pregCount = (arr) => arr.filter(isPreg).length;
    const rankOf = (a) => {
      const r = String(a.role || '');
      if (/正妻|大娘子/.test(r)) return '正妻';
      if (/如夫人|二房|侧室|妾/.test(r)) return '二房';
      if (/通房|丫鬟|婢/.test(r)) return '通房';
      return '府内';
    };
    const ord = { 正妻: 0, 二房: 1, 通房: 2, 府内: 3 };
    inHouse.sort((x, y) => ord[rankOf(x)] - ord[rankOf(y)]);
    const mainCnt = (k) => inHouse.filter(a => rankOf(a) === k).length;
    const outPreg = pregCount(outHouse);

    $('h-family-top').textContent =
      `正妻 ${mainCnt('正妻')} · 侧室 ${mainCnt('二房')} · 通房 ${mainCnt('通房')}`
      + (outHouse.length ? ` ｜ 外室 ${outHouse.length}${outPreg ? `（${outPreg} 有孕）` : ''}` : '');

    const rowOf = (a, tag) => `<div class="row">
        <span><b>${a.name}</b> <span class="tag" style="margin-left:4px">${tag}</span>${isPreg(a) ? `<span class="tag good" style="margin-left:4px">有喜 ${Number(a.pregnancy?.days) || 0} 天</span>` : ''}</span>
        <span class="muted">${a.place || ''}</span>
      </div>`;

    let html = '';
    if (inHouse.length) {
      html += `<div class="muted" style="margin:4px 0 2px">府内</div>`;
      html += inHouse.map(a => rowOf(a, rankOf(a))).join('');
    }
    if (outHouse.length) {
      html += `<div class="muted" style="margin:8px 0 2px">外室 · 不入府（世人不知）</div>`;
      html += outHouse.map(a => rowOf(a, '相好')).join('');
    }
    $('family-detail').innerHTML = html || '<div class="muted">府中尚无内眷</div>';
  }

'''
    lines = lines[:old_start] + new_block.split('\n') + lines[old_end:]
    print('① 家宅卡已改写（府内/外室分开）')

# ---------- ② 账目卡：过滤脏产业（0 收入且无掌柜） ----------
for i, l in enumerate(lines):
    if 'const props = w.assets?.properties || [];' in l:
        lines[i] = ("    const props = (w.assets?.properties || []).filter(p => "
                    "(Number(p.incomePerDay) || 0) > 0 || p.keeperName);")
        print('② 账目卡已过滤脏产业')
        break

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('done')
